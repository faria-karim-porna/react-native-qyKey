package com.qykey

import android.app.Application
import android.content.res.Configuration
import android.os.Build
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactPackage
import com.facebook.react.ReactPackageTurboModuleManagerDelegate
import com.facebook.react.bridge.JSBundleLoader
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.interfaces.TaskInterface
import com.facebook.react.common.build.ReactBuildConfig
import com.facebook.react.common.annotations.UnstableReactNativeAPI
import com.facebook.react.defaults.DefaultComponentsRegistry
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultTurboModuleManagerDelegate
import com.facebook.react.fabric.ComponentFactory
import com.facebook.react.runtime.BindingsInstaller
import com.facebook.react.runtime.JSRuntimeFactory
import com.facebook.react.runtime.ReactHostDelegate
import com.facebook.react.runtime.ReactHostImpl
import com.facebook.react.runtime.hermes.HermesInstance
import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

class QyKeyApplication : Application(), ReactApplication {

    companion object {
        private const val TAG = "QyKeyApplication"
    }

    // ── Main ReactHost (managed by Expo, uses main bundle) ──────────
    override val reactHost: ReactHost by lazy {
        ExpoReactHostFactory.getDefaultReactHost(
            context = applicationContext,
            packageList = PackageList(this).packages.apply {
                add(QyKeyPackage())
            }
        )
    }

    // ── Keyboard ReactHost (lazily initialized, uses keyboard.bundle) ──────────
    @Volatile
    private var _keyboardReactHost: ReactHost? = null

    @Volatile
    private var _keyboardHostReady: Boolean = false

    // The async Task returned by keyboardHost.start(). Lets the IME service check
    // whether React initialization actually succeeded instead of silently showing
    // a blank keyboard when it fails.
    @Volatile
    var keyboardStartTask: TaskInterface<Void>? = null

    // Class-level lock for keyboard ReactHost initialization
    private val keyboardInitLock = Any()

    // Whether this process is the dedicated IME process (QyKeyInputMethodService is
    // declared with android:process=":ime_process"). Application.getProcessName() is
    // API 28+; older versions read /proc/self/cmdline.
    private val isImeProcess: Boolean by lazy {
        val name = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            Application.getProcessName()
        } else {
            try {
                java.io.File("/proc/self/cmdline")
                    .readBytes().toString(Charsets.US_ASCII)
                    .substringBefore('\u0000')
            } catch (e: Exception) {
                null
            }
        }
        name?.endsWith(":ime_process") == true
    }

    val isKeyboardHostReady: Boolean
        get() = _keyboardHostReady

    val keyboardReactHost: ReactHost
        get() {
            val host = _keyboardReactHost
            if (host != null) return host
            // Synchronous initialization on caller's thread (IME service thread)
            try {
                initKeyboardRuntime()
        } catch (e: Throwable) {
            Log.e(TAG, "Failed to init keyboard ReactHost synchronously", e)
            Log.e(TAG, "This usually means keyboard.bundle is missing or corrupt in the APK.", e)
        }
        return _keyboardReactHost ?: throw IllegalStateException(
            "Keyboard ReactHost failed to initialize. " +
            "Likely cause: keyboard.bundle not found in assets. " +
            "Run 'expo prebuild' and verify keyboard.bundle exists in android/app/src/main/assets/"
        )
        }

    /**
     * Tears down the keyboard ReactHost so the NEXT keyboard open creates a completely fresh
     * React pipeline (new ReactInstance → new FabricUIManager → new MountItemDispatcher).
     *
     * Used by the IME watchdog when the host was destroyed mid-session (a lifecycle-listener
     * exception inside ReactContext.onHostResume() → ReactHost.destroy()) or when the Fabric
     * mount pipeline wedged. A one-time startup fault often resolves itself on the next open
     * with a clean host; without this, a wedged host would keep failing every open.
     *
     * Safe to fire-and-forget: destroy() is asynchronous, and the keyboardReactHost getter
     * lazily re-initializes a new host on the next access (initKeyboardRuntime is guarded by
     * keyboardInitLock, so a concurrent access cannot double-create).
     */
    fun resetKeyboardHostForRetry() {
        // Guard with the same lock initKeyboardRuntime uses, so a concurrent getter cannot
        // re-create a host between the null-out and the destroy below.
        val oldHost: ReactHost?
        synchronized(keyboardInitLock) {
            oldHost = _keyboardReactHost
            _keyboardReactHost = null
            _keyboardHostReady = false
            keyboardStartTask = null
        }
        if (oldHost == null) return
        try {
            oldHost.destroy("QyKey watchdog: resetting keyboard host for next open", null)
        } catch (e: Exception) {
            Log.w(TAG, "Keyboard host destroy during reset failed: ${e.message}")
        }
        Log.i(TAG, "Keyboard ReactHost marked for teardown — next open will create a fresh host")
    }

    override fun onCreate() {
        super.onCreate()

        // ── Set the React Native release level (matches MainApplication.kt) ──
        // Required by DefaultNewArchitectureEntryPoint for proper Fabric setup.
        DefaultNewArchitectureEntryPoint.releaseLevel = try {
            ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
        } catch (e: IllegalArgumentException) {
            ReleaseLevel.STABLE
        }

        // ── Initialize React Native runtime ──
        // This is the canonical React Native 0.86 initialization call.
        // It handles:
        //   - SoLoader.init() (native library loader)
        //   - Fabric / New Architecture runtime setup
        //   - Hermes engine registration
        //   - All native library loading paths
        //
        // This MUST be called before ExpoReactHostFactory or ComponentFactory
        // are touched, as ComponentFactory.<clinit> calls
        // FabricSoLoader.staticInit() → SoLoader.loadLibrary("fabricjni").
        loadReactNative(this)

        // ── Initialize Expo module lifecycle ──
        ApplicationLifecycleDispatcher.onApplicationCreate(this)

        // ── Pre-warm the keyboard ReactHost in the IME process ────────────────
        // The IME process exists ONLY to serve the keyboard, so warming the host
        // here — immediately after loadReactNative() has initialized SoLoader —
        // moves the expensive startup steps (ComponentFactory creation + the
        // ~911KB Hermes keyboard.bundle load) OUT of the critical path of the first
        // keyboard open. Without this the host was initialized lazily on the main
        // thread inside QyKeyInputMethodService.onCreateInputView(), right as the
        // input window was appearing — the user saw a black keyboard area for
        // 1–3s before the keys mounted.
        //
        // Safe now: the pre-warm that previously crashed ran BEFORE loadReactNative()
        // existed, so ComponentFactory.<clinit> → SoLoader.loadLibrary("fabricjni")
        // raced an uninitialized SoLoader. loadReactNative() initializes SoLoader
        // first, so touching ComponentFactory here is race-free.
        //
        // Guarded to :ime_process: the MAIN app process also runs this Application,
        // but its users may never open the keyboard — it must not burn a Hermes
        // runtime + 911KB bundle there.
        if (isImeProcess) {
            try {
                keyboardReactHost // lazy getter → initKeyboardRuntime() + host.start()
                Log.i(TAG, "Keyboard ReactHost pre-warmed in IME process")
            } catch (e: Throwable) {
                // Best-effort: on failure the lazy getter retries on the first
                // keyboard open (existing behavior).
                Log.w(TAG, "Keyboard ReactHost pre-warm failed — will retry on first open", e)
            }
        }
    }

    @OptIn(UnstableReactNativeAPI::class)
    private fun initKeyboardRuntime() {
        // Thread-safe single initialization
        if (_keyboardReactHost != null) return

        // Use class-level lock, not a local variable!
        synchronized(keyboardInitLock) {
            if (_keyboardReactHost != null) return

            Log.i(TAG, "Initializing keyboard ReactHost...")

            val keyboardDelegate = object : ReactHostDelegate {
                override val jsMainModulePath: String = "keyboard.index"

                override val jsBundleLoader: JSBundleLoader
                    get() = JSBundleLoader.createAssetLoader(
                        this@QyKeyApplication,
                        "assets://keyboard.bundle",
                        true
                    )

                override val jsRuntimeFactory: JSRuntimeFactory
                    get() = HermesInstance()

                // Includes MainReactPackage (via PackageList) for standard React Native core view managers
                // (View, Text, TouchableOpacity, etc.) + QyKeyPackage for native IME bridge methods
                override val reactPackages: List<ReactPackage>
                    get() = PackageList(this@QyKeyApplication).packages.apply {
                        if (none { it is QyKeyPackage }) add(QyKeyPackage())
                    }

                override val bindingsInstaller: BindingsInstaller? = null

                override val turboModuleManagerDelegateBuilder: ReactPackageTurboModuleManagerDelegate.Builder
                    get() = DefaultTurboModuleManagerDelegate.Builder()

                override fun handleInstanceException(error: Exception) {
                    Log.e(TAG, "Keyboard ReactHost instance exception", error)
                }
            }

            Log.i(TAG, "Creating ComponentFactory...")
            val componentFactory = ComponentFactory()
            DefaultComponentsRegistry.register(componentFactory)

            Log.i(TAG, "Creating ReactHostImpl for keyboard...")
            val keyboardHost = ReactHostImpl(
                this,
                delegate = keyboardDelegate,
                componentFactory = componentFactory,
                allowPackagerServerAccess = false,  // Keyboard bundle doesn't need Metro
                useDevSupport = ReactBuildConfig.DEBUG
            )

            _keyboardReactHost = keyboardHost

            // Start loading JS — this is the expensive step (~200-500ms first time)
            // NOTE: start() is ASYNC — it returns immediately and loads the JS
            // bundle in the background. The Task is kept so the IME service can
            // detect failures and show a visible error instead of a blank keyboard.
            Log.i(TAG, "Starting keyboard ReactHost (async)...")
            keyboardStartTask = keyboardHost.start()
            _keyboardHostReady = true
            Log.i(TAG, "Keyboard ReactHost start() invoked — JS bundle loading from assets://keyboard.bundle")

            // NOTE: the keyboard ReactHost is deliberately NOT resumed here.
            // ReactHost.onHostResume(null) must only be called once the ReactInstance
            // EXISTS — see QyKeyInputMethodService.scheduleHostResume(). Resuming
            // before the instance was created (a previous iteration) moved the lifecycle
            // to RESUMED prematurely: the bootstrap resume path then dispatched
            // ReactContext.onHostResume() mid-initialization, and any listener failure
            // escalated through ReactContext.handleException → ReactHost.destroy() → a
            // silent create/destroy loop that left the surface not running and the JS
            // never mounting (the reported "isRunning=false jsReady=false" error after
            // 17s in the EAS release build).
        }
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
    }
}

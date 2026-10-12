package com.qykey

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log

class HapticManager(context: Context) {

    companion object {
        private const val TAG = "HapticManager"
        private const val VIBRATION_MS = 25L   // 25ms — short enough to feel instant
    }

    private val vibrator: Vibrator? = try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE)
                    as VibratorManager
            manager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
    } catch (e: Exception) {
        Log.w(TAG, "Could not get Vibrator: ${e.message}")
        null
    }

    // Pre-create the effect once — do NOT create inside vibrate()
    private val effect: VibrationEffect? = try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            VibrationEffect.createOneShot(
                VIBRATION_MS,
                VibrationEffect.DEFAULT_AMPLITUDE
            )
        } else null
    } catch (e: Exception) {
        Log.w(TAG, "Could not create VibrationEffect: ${e.message}")
        null
    }

    private var isEnabled: Boolean = true

    fun setEnabled(enabled: Boolean) {
        isEnabled = enabled
    }

    fun vibrate() {
        if (!isEnabled) return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && effect != null) {
                vibrator?.vibrate(effect)
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(VIBRATION_MS)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Vibration failed: ${e.message}")
        }
    }
}

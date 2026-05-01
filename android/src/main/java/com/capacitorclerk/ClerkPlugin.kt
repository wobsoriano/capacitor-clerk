package com.capacitorclerk

import android.app.Activity
import android.content.Intent
import android.widget.FrameLayout
import androidx.activity.result.ActivityResult
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clerk.api.Clerk
import com.clerk.ui.userprofile.UserProfileView
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import java.lang.ref.WeakReference

@CapacitorPlugin(name = "ClerkNative")
class ClerkPlugin : Plugin() {

    companion object {
        // Weak refs so activities can be reached for programmatic dismiss.
        // Static because Android creates Activities independently of the plugin instance.
        var authActivityRef: WeakReference<ClerkAuthActivity>? = null
        var profileActivityRef: WeakReference<ClerkUserProfileActivity>? = null
    }

    private var inlineProfileView: ComposeView? = null
    private val mainScope = CoroutineScope(Dispatchers.Main)

    // MARK: - configure

    @PluginMethod
    fun configure(call: PluginCall) {
        val publishableKey = call.getString("publishableKey") ?: run {
            call.reject("publishableKey is required")
            return
        }
        val bearerToken = call.getString("bearerToken")

        mainScope.launch {
            try {
                if (!Clerk.isInitialized.value) {
                    Clerk.initialize(context, publishableKey)
                    withTimeout(10_000L) {
                        Clerk.isInitialized.first { it }
                    }
                }
                if (!bearerToken.isNullOrEmpty()) {
                    Clerk.updateDeviceToken(bearerToken)
                }
                call.resolve()
            } catch (e: Exception) {
                call.reject("configure failed: ${e.message}", e)
            }
        }
    }

    // MARK: - presentAuth

    @PluginMethod
    fun presentAuth(call: PluginCall) {
        val mode = call.getString("mode") ?: "signInOrUp"
        val intent = Intent(activity, ClerkAuthActivity::class.java).apply {
            putExtra("mode", mode)
        }
        startActivityForResult(call, intent, "onAuthResult")
    }

    @ActivityCallback
    private fun onAuthResult(call: PluginCall?, result: ActivityResult) {
        if (result.resultCode == Activity.RESULT_OK) {
            val sessionId = result.data?.getStringExtra("sessionId") ?: ""
            notifyListeners("authCompleted", JSObject().put("sessionId", sessionId))
        }
        call?.resolve()
    }

    // MARK: - dismissAuth

    @PluginMethod
    fun dismissAuth(call: PluginCall) {
        authActivityRef?.get()?.finish()
        call.resolve()
    }

    // MARK: - getClientToken

    @PluginMethod
    fun getClientToken(call: PluginCall) {
        val token = try { Clerk.getDeviceToken() } catch (e: Exception) { null }
        call.resolve(JSObject().put("token", token))
    }

    // MARK: - presentUserProfile

    @PluginMethod
    fun presentUserProfile(call: PluginCall) {
        val intent = Intent(activity, ClerkUserProfileActivity::class.java).apply {
            putExtra("isDismissable", true)
        }
        startActivityForResult(call, intent, "onProfileResult")
    }

    @ActivityCallback
    private fun onProfileResult(call: PluginCall?, result: ActivityResult) {
        val signedOut = result.data?.getBooleanExtra("signedOut", false) == true
        if (signedOut) {
            notifyListeners("profileEvent", JSObject().put("type", "signedOut"))
        }
        notifyListeners("profileDismissed", JSObject())
        call?.resolve()
    }

    // MARK: - dismissUserProfile

    @PluginMethod
    fun dismissUserProfile(call: PluginCall) {
        profileActivityRef?.get()?.finish()
        call.resolve()
    }

    // MARK: - createUserProfile (inline overlay)

    @PluginMethod
    fun createUserProfile(call: PluginCall) {
        val rectObj = call.getObject("boundingRect") ?: run {
            call.reject("boundingRect is required")
            return
        }
        val isDismissable = call.getBoolean("isDismissable", false) ?: false
        val density = activity.resources.displayMetrics.density

        val x = (rectObj.optDouble("x", 0.0) * density).toInt()
        val y = (rectObj.optDouble("y", 0.0) * density).toInt()
        val w = (rectObj.optDouble("width", 0.0) * density).toInt()
        val h = (rectObj.optDouble("height", 0.0) * density).toInt()

        activity.runOnUiThread {
            destroyInlineProfile()

            val view = ComposeView(activity).apply {
                setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
                setContent {
                    val session by Clerk.sessionFlow.collectAsStateWithLifecycle()
                    var hadSession by remember { mutableStateOf(Clerk.session != null) }

                    LaunchedEffect(session) {
                        if (hadSession && session == null) {
                            notifyListeners("profileEvent", JSObject().put("type", "signedOut"))
                        }
                        if (session != null) hadSession = true
                    }

                    MaterialTheme {
                        UserProfileView(
                            clerkTheme = Clerk.customTheme,
                            onDismiss = {
                                if (isDismissable) {
                                    notifyListeners("profileEvent", JSObject().put("type", "dismissed"))
                                }
                            }
                        )
                    }
                }
            }

            val parent = bridge.webView.parent as? android.view.ViewGroup ?: run {
                call.reject("WebView parent not available")
                return@runOnUiThread
            }
            val params = FrameLayout.LayoutParams(w, h).apply {
                leftMargin = x
                topMargin = y
            }
            parent.addView(view, params)
            inlineProfileView = view
            call.resolve()
        }
    }

    // MARK: - updateUserProfile

    @PluginMethod
    fun updateUserProfile(call: PluginCall) {
        val rectObj = call.getObject("boundingRect") ?: run {
            call.resolve()
            return
        }
        val density = activity.resources.displayMetrics.density
        val x = (rectObj.optDouble("x", 0.0) * density).toInt()
        val y = (rectObj.optDouble("y", 0.0) * density).toInt()
        val w = (rectObj.optDouble("width", 0.0) * density).toInt()
        val h = (rectObj.optDouble("height", 0.0) * density).toInt()

        activity.runOnUiThread {
            val view = inlineProfileView ?: run { call.resolve(); return@runOnUiThread }
            val params = (view.layoutParams as? FrameLayout.LayoutParams)
                ?: FrameLayout.LayoutParams(w, h)
            params.width = w
            params.height = h
            params.leftMargin = x
            params.topMargin = y
            view.layoutParams = params
            view.requestLayout()
            call.resolve()
        }
    }

    // MARK: - destroyUserProfile

    @PluginMethod
    fun destroyUserProfile(call: PluginCall) {
        activity.runOnUiThread {
            destroyInlineProfile()
            call.resolve()
        }
    }

    private fun destroyInlineProfile() {
        inlineProfileView?.let { view ->
            (view.parent as? android.view.ViewGroup)?.removeView(view)
        }
        inlineProfileView = null
    }
}

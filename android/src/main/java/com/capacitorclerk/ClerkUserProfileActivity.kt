package com.capacitorclerk

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clerk.api.Clerk
import com.clerk.ui.userprofile.UserProfileView
import java.lang.ref.WeakReference

class ClerkUserProfileActivity : ComponentActivity() {

    private var dismissed = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        ClerkPlugin.profileActivityRef = WeakReference(this)

        val isDismissable = intent.getBooleanExtra("isDismissable", true)

        setContent {
            val session by Clerk.sessionFlow.collectAsStateWithLifecycle()
            var hadSession by remember { mutableStateOf(Clerk.session != null) }

            LaunchedEffect(session) {
                if (hadSession && session == null) {
                    finishWithResult(signedOut = true)
                }
                if (session != null) hadSession = true
            }

            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    UserProfileView(
                        clerkTheme = Clerk.customTheme,
                        onDismiss = { finishWithResult(signedOut = false) }
                    )
                }
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (isDismissable) finishWithResult(signedOut = false)
                // else: swallow back press
            }
        })
    }

    override fun onDestroy() {
        super.onDestroy()
        if (ClerkPlugin.profileActivityRef?.get() === this) {
            ClerkPlugin.profileActivityRef = null
        }
    }

    private fun finishWithResult(signedOut: Boolean) {
        if (dismissed) return
        dismissed = true
        setResult(
            Activity.RESULT_OK,
            Intent().putExtra("signedOut", signedOut)
        )
        finish()
    }
}

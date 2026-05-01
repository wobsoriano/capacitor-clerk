package com.capacitorclerk

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clerk.api.Clerk
import com.clerk.ui.auth.AuthView
import java.lang.ref.WeakReference

class ClerkAuthActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ClerkPlugin.authActivityRef = WeakReference(this)

        val mode = intent.getStringExtra("mode") ?: "signInOrUp"
        val initialSessionId = Clerk.session?.id

        setContent {
            val session by Clerk.sessionFlow.collectAsStateWithLifecycle()
            var isAuthComplete by remember { mutableStateOf(false) }

            LaunchedEffect(session) {
                val id = session?.id
                if (id != null && id != initialSessionId && !isAuthComplete) {
                    isAuthComplete = true
                    setResult(Activity.RESULT_OK, Intent().putExtra("sessionId", id))
                    finish()
                }
            }

            BackHandler {
                setResult(Activity.RESULT_CANCELED)
                finish()
            }

            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    if (isAuthComplete) {
                        // Swap out AuthView before finish() to prevent Compose
                        // navigation crash on empty backstack.
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(16.dp)
                            ) {
                                CircularProgressIndicator(Modifier.size(48.dp))
                                Text("Signing in...", style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    } else {
                        AuthView(
                            modifier = Modifier.fillMaxSize(),
                            clerkTheme = Clerk.customTheme
                        )
                    }
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (ClerkPlugin.authActivityRef?.get() === this) {
            ClerkPlugin.authActivityRef = null
        }
    }
}

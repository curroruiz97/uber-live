package com.sapiens.telcolive;

import android.content.res.Resources;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebView;

import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Edge-to-edge ANTES de super.onCreate (que llama setContentView)
        applyEdgeToEdge();

        // BridgeActivity: setContentView + bridge + plugins
        super.onCreate(savedInstanceState);

        // Re-aplicar DESPUÉS de super.onCreate por si algo lo revirtió
        applyEdgeToEdge();

        // Consumir insets y forzar padding 0 en todo el árbol
        View rootView = findViewById(android.R.id.content);
        if (rootView != null) {
            ViewCompat.setOnApplyWindowInsetsListener(rootView, (v, insets) -> {
                v.setPadding(0, 0, 0, 0);
                return WindowInsetsCompat.CONSUMED;
            });
            rootView.requestApplyInsets();
        }

        // Forzar el deprecated flag también, para compatibilidad con plugins
        // que chequean SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN (Keyboard, StatusBar)
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
            decorView.getSystemUiVisibility()
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        );

        // Inyectar safe area insets en el WebView como CSS custom properties
        rootView.post(() -> {
            int topPx = getSystemBarPx("status_bar_height");
            int bottomPx = getSystemBarPx("navigation_bar_height");
            float density = getResources().getDisplayMetrics().density;
            int topDp = Math.round(topPx / density);
            int bottomDp = Math.round(bottomPx / density);

            WebView webView = findViewById(R.id.webview);
            if (webView != null) {
                String js = "document.documentElement.style.setProperty('--sat','" + topDp + "px');"
                    + "document.documentElement.style.setProperty('--sab','" + bottomDp + "px');"
                    + "document.documentElement.style.setProperty('--sal','0px');"
                    + "document.documentElement.style.setProperty('--sar','0px');";
                webView.evaluateJavascript(js, null);
            }
        });
    }

    private void applyEdgeToEdge() {
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams params = window.getAttributes();
            params.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(params);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setNavigationBarContrastEnforced(false);
            window.setStatusBarContrastEnforced(false);
        }
    }

    private int getSystemBarPx(String resourceName) {
        Resources res = getResources();
        int id = res.getIdentifier(resourceName, "dimen", "android");
        return id > 0 ? res.getDimensionPixelSize(id) : 0;
    }
}

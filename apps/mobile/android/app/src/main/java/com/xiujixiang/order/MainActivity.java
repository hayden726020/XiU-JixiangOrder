package com.xiujixiang.order;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView == null) {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    return;
                }
                webView.evaluateJavascript(
                    "(function() {"
                        + "try {"
                        + "  if (typeof window.__xiuHandleBackPress === 'function') {"
                        + "    return window.__xiuHandleBackPress() ? 'HANDLED' : 'ROOT';"
                        + "  }"
                        + "  var h = window.location.hash || '';"
                        + "  if (h && h !== '#' && h !== '#/') {"
                        + "    window.location.hash = '/';"
                        + "    return 'HANDLED';"
                        + "  }"
                        + "  return 'ROOT';"
                        + "} catch (e) { return 'ROOT'; }"
                        + "})()",
                    result -> {
                        if ("\"HANDLED\"".equals(result)) {
                            return;
                        }
                        finish();
                    }
                );
            }
        });
    }
}

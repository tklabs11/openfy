package com.openfy.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Atualização do APK pelo próprio app: baixa o arquivo do GitHub Releases para o
 * cache e abre o instalador do sistema (mesma ideia do atualizador do desktop).
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject result = new JSObject();
        result.put("allowed", canInstallPackages());
        call.resolve(result);
    }

    /** Abre a tela do sistema para permitir "instalar apps desconhecidos" deste app. */
    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url", "");
        String name = call.getString("name", "openfy.apk");
        if (!url.startsWith("https://")) {
            call.reject("Endereço inválido para a atualização.");
            return;
        }
        new Thread(() -> downloadFile(call, url, name.replaceAll("[^\\w.\\-]", "_"))).start();
    }

    @PluginMethod
    public void install(PluginCall call) {
        String path = call.getString("path", "");
        File file = new File(path);
        if (!file.exists()) {
            call.reject("O arquivo da atualização não foi encontrado. Baixe novamente.");
            return;
        }
        if (!canInstallPackages()) {
            call.reject("Permita a instalação de apps desconhecidos para o Openfy.");
            return;
        }
        try {
            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                file
            );
            Intent intent = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Não foi possível abrir o instalador.", error);
        }
    }

    private boolean canInstallPackages() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        return getContext().getPackageManager().canRequestPackageInstalls();
    }

    private void downloadFile(PluginCall call, String url, String name) {
        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.exists() && !dir.mkdirs()) {
            call.reject("Não foi possível preparar o download da atualização.");
            return;
        }
        File target = new File(dir, name);
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            connection.setInstanceFollowRedirects(true);
            connection.connect();
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) throw new IOException("HTTP " + status);

            long total = connection.getContentLengthLong();
            int lastPercent = -1;
            long read = 0;
            byte[] buffer = new byte[64 * 1024];
            try (InputStream input = connection.getInputStream();
                 FileOutputStream output = new FileOutputStream(target)) {
                int count;
                while ((count = input.read(buffer)) > 0) {
                    output.write(buffer, 0, count);
                    read += count;
                    if (total > 0) {
                        int percent = (int) (read * 100 / total);
                        if (percent != lastPercent) {
                            lastPercent = percent;
                            emitProgress(percent);
                        }
                    }
                }
            }

            JSObject result = new JSObject();
            result.put("path", target.getAbsolutePath());
            call.resolve(result);
        } catch (Exception error) {
            // Arquivo parcial não serve para instalar.
            if (target.exists() && !target.delete()) target.deleteOnExit();
            call.reject("Não foi possível baixar a atualização.", error);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private void emitProgress(int percent) {
        if (getActivity() == null) return;
        getActivity().runOnUiThread(() -> {
            JSObject data = new JSObject();
            data.put("percent", percent);
            notifyListeners("progress", data);
        });
    }
}

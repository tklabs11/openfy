package com.openfy.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackgroundAudio")
public class BackgroundAudioPlugin extends Plugin {

    private static BackgroundAudioPlugin pipRelay;

    @Override
    public void load() {
        pipRelay = this;
        PlaybackService.setCommandListener(command -> {
            if (getActivity() == null) return;
            getActivity().runOnUiThread(() -> {
                JSObject data = new JSObject();
                data.put("command", command);
                notifyListeners("command", data);
            });
        });
    }

    @Override
    protected void handleOnDestroy() {
        pipRelay = null;
        PlaybackService.setCommandListener(null);
        // O WebView morreu junto com o app: sem áudio não faz sentido manter
        // o serviço nem a notificação na tela.
        getContext().stopService(new Intent(getContext(), PlaybackService.class));
        super.handleOnDestroy();
    }

    static void notifyPipChanged(boolean inPip) {
        BackgroundAudioPlugin relay = pipRelay;
        if (relay == null) return;
        JSObject data = new JSObject();
        data.put("inPip", inPip);
        relay.notifyListeners("pip", data);
    }

    private MainActivity activity() {
        return getActivity() instanceof MainActivity ? (MainActivity) getActivity() : null;
    }

    @PluginMethod
    public void isPipSupported(PluginCall call) {
        MainActivity activity = activity();
        JSObject result = new JSObject();
        result.put("supported", activity != null && activity.isPipAvailable());
        call.resolve(result);
    }

    @PluginMethod
    public void setVideoPlaying(PluginCall call) {
        boolean playing = Boolean.TRUE.equals(call.getBoolean("playing", false));
        MainActivity activity = activity();
        if (activity != null) activity.runOnUiThread(() -> activity.setVideoPlaying(playing));
        call.resolve();
    }

    @PluginMethod
    public void enterPictureInPicture(PluginCall call) {
        MainActivity activity = activity();
        JSObject result = new JSObject();
        boolean supported = activity != null && activity.isPipAvailable();
        result.put("supported", supported);
        if (supported) activity.runOnUiThread(activity::enterVideoPip);
        call.resolve(result);
    }

    @PluginMethod
    public void start(PluginCall call) {
        requestNotificationPermission();
        Intent intent = new Intent(getContext(), PlaybackService.class);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
            call.resolve();
        } catch (Exception error) {
            // Android 12+ pode recusar iniciar em segundo plano; a música continua se o processo estiver vivo.
            call.reject("Não foi possível iniciar o serviço de reprodução.", error);
        }
    }

    @PluginMethod
    public void update(PluginCall call) {
        PlaybackService.updateState(
            call.getString("title", ""),
            call.getString("artist", ""),
            call.getString("album", ""),
            call.getString("artwork", ""),
            Boolean.TRUE.equals(call.getBoolean("playing", false)),
            Math.round(call.getDouble("duration", 0d) * 1000),
            Math.round(call.getDouble("position", 0d) * 1000)
        );
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), PlaybackService.class));
        call.resolve();
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return;
        if (getActivity() == null) return;
        boolean granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED;
        if (!granted) {
            getActivity().requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 4321);
        }
    }
}

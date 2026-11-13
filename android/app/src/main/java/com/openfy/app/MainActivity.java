package com.openfy.app;

import android.app.PictureInPictureParams;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean videoPlaying = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackgroundAudioPlugin.class);
        registerPlugin(AppUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }

    /** A ponte avisa quando um vídeo do YouTube está tocando de fato. */
    void setVideoPlaying(boolean playing) {
        if (videoPlaying == playing) return;
        videoPlaying = playing;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                // Android 12+ entra em janela flutuante sozinho ao sair do app.
                setPictureInPictureParams(pipParams(playing));
            } catch (Exception ignored) {
                // Aparelhos sem suporte recusam os parâmetros e seguem sem PiP.
            }
        }
    }

    boolean isPipAvailable() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && getPackageManager().hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE);
    }

    void enterVideoPip() {
        if (!videoPlaying || !isPipAvailable() || isInPictureInPictureMode()) return;
        try {
            enterPictureInPictureMode(pipParams(true));
        } catch (Exception ignored) {
            // Sem PiP o vídeo pausa em segundo plano, como antes.
        }
    }

    @Override
    public void onUserLeaveHint() {
        super.onUserLeaveHint();
        // Do Android 12 em diante o sistema entra sozinho; antes disso é manual.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) enterVideoPip();
    }

    @Override
    public void onPictureInPictureModeChanged(boolean inPictureInPicture, Configuration config) {
        super.onPictureInPictureModeChanged(inPictureInPicture, config);
        BackgroundAudioPlugin.notifyPipChanged(inPictureInPicture);
    }

    private PictureInPictureParams pipParams(boolean autoEnter) {
        PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder()
            .setAspectRatio(new Rational(16, 9));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) builder.setAutoEnterEnabled(autoEnter);
        return builder.build();
    }
}

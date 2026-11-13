package com.openfy.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Serve duas funções: mantém o processo vivo em segundo plano e publica a
 * MediaSession nativa — é ela que aparece na tela de bloqueio e nos fones.
 */
public class PlaybackService extends Service {
    public static final String ACTION_TOGGLE = "com.openfy.app.TOGGLE";
    public static final String ACTION_NEXT = "com.openfy.app.NEXT";
    public static final String ACTION_PREV = "com.openfy.app.PREV";

    private static final String CHANNEL_ID = "openfy-playback";
    private static final int NOTIFICATION_ID = 1001;

    public interface CommandListener {
        void onCommand(String command);
    }

    private static PlaybackService instance;
    private static CommandListener listener;

    private MediaSession session;
    private String title = "";
    private String artist = "";
    private String album = "";
    private String artworkUrl = "";
    private Bitmap artwork;
    private boolean playing = false;
    private long durationMs = 0;
    private long positionMs = 0;
    private String notificationSignature = "";

    public static void setCommandListener(CommandListener value) {
        listener = value;
    }

    private static void emit(String command) {
        CommandListener current = listener;
        if (current != null) current.onCommand(command);
    }

    /** Atualiza metadados e estado; ignorado quando o serviço não está ativo. */
    public static void updateState(
        String nextTitle,
        String nextArtist,
        String nextAlbum,
        String nextArtwork,
        boolean nextPlaying,
        long nextDurationMs,
        long nextPositionMs
    ) {
        PlaybackService service = instance;
        if (service == null) return;
        service.applyState(nextTitle, nextArtist, nextAlbum, nextArtwork, nextPlaying, nextDurationMs, nextPositionMs);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        createChannel();
        session = new MediaSession(this, "Openfy");
        session.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
        session.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                emit("play");
            }

            @Override
            public void onPause() {
                emit("pause");
            }

            @Override
            public void onSkipToNext() {
                emit("next");
            }

            @Override
            public void onSkipToPrevious() {
                emit("prev");
            }

            @Override
            public void onSeekTo(long position) {
                emit("seek:" + (position / 1000.0));
            }
        });
        // Volume das teclas físicas passa a controlar a mídia, e tocar na sessão
        // (tela de bloqueio, painel do sistema) abre o app.
        session.setPlaybackToLocal(new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build());
        session.setSessionActivity(openAppIntent());
        session.setActive(true);
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // O WebView é destruído ao fechar o app: sem ele não há áudio, então o
        // serviço e a notificação também saem.
        stopSelf();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_TOGGLE.equals(action)) emit(playing ? "pause" : "play");
        else if (ACTION_NEXT.equals(action)) emit("next");
        else if (ACTION_PREV.equals(action)) emit("prev");

        startForegroundCompat(buildNotification());
        notificationSignature = currentSignature();
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        if (session != null) {
            session.setActive(false);
            session.release();
            session = null;
        }
        instance = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void applyState(
        String nextTitle,
        String nextArtist,
        String nextAlbum,
        String nextArtwork,
        boolean nextPlaying,
        long nextDurationMs,
        long nextPositionMs
    ) {
        boolean artworkChanged = nextArtwork != null && !nextArtwork.equals(artworkUrl);
        title = nextTitle != null ? nextTitle : "";
        artist = nextArtist != null ? nextArtist : "";
        album = nextAlbum != null ? nextAlbum : "";
        playing = nextPlaying;
        durationMs = Math.max(0, nextDurationMs);
        positionMs = Math.max(0, nextPositionMs);

        if (artworkChanged) {
            artworkUrl = nextArtwork;
            artwork = null;
            loadArtwork(artworkUrl);
        }

        publish();
        refreshNotification();
    }

    private void publish() {
        if (session == null) return;
        MediaMetadata.Builder metadata = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, title)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadata.METADATA_KEY_ALBUM, album)
            .putLong(MediaMetadata.METADATA_KEY_DURATION, durationMs);
        if (artwork != null) metadata.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, artwork);
        session.setMetadata(metadata.build());

        long actions = PlaybackState.ACTION_PLAY
            | PlaybackState.ACTION_PAUSE
            | PlaybackState.ACTION_PLAY_PAUSE
            | PlaybackState.ACTION_SKIP_TO_NEXT
            | PlaybackState.ACTION_SKIP_TO_PREVIOUS
            | PlaybackState.ACTION_SEEK_TO;
        session.setPlaybackState(new PlaybackState.Builder()
            .setActions(actions)
            // Em pausa a velocidade é zero; sem isso o sistema continua avançando
            // a barra de progresso na tela de bloqueio.
            .setState(
                playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED,
                positionMs,
                playing ? 1f : 0f
            )
            .build());
    }

    private void loadArtwork(String url) {
        if (url == null || url.isEmpty()) return;
        new Thread(() -> {
            Bitmap bitmap = null;
            try {
                HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setConnectTimeout(8000);
                connection.setReadTimeout(8000);
                connection.setDoInput(true);
                connection.connect();
                try (InputStream input = connection.getInputStream()) {
                    bitmap = BitmapFactory.decodeStream(input);
                }
                connection.disconnect();
            } catch (Exception ignored) {
                // Sem capa, a notificação usa o ícone padrão.
            }
            if (bitmap == null || !url.equals(artworkUrl)) return;
            artwork = bitmap;
            publish();
            refreshNotification();
        }).start();
    }

    /** Reposta a notificação só quando algo visível mudou (posição muda a cada segundo). */
    private void refreshNotification() {
        String signature = currentSignature();
        if (signature.equals(notificationSignature)) return;
        notificationSignature = signature;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification());
    }

    private String currentSignature() {
        return title + '\u0001' + artist + '\u0001' + (playing ? '1' : '0')
            + '\u0001' + artworkUrl + '\u0001' + (artwork != null ? '1' : '0');
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            getString(R.string.playback_channel_name),
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setShowBadge(false);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private PendingIntent serviceIntent(String action, int code) {
        Intent intent = new Intent(this, PlaybackService.class).setAction(action);
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
            ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            : PendingIntent.FLAG_UPDATE_CURRENT;
        return PendingIntent.getService(this, code, intent, flags);
    }

    private PendingIntent openAppIntent() {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int pendingFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
            ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            : PendingIntent.FLAG_UPDATE_CURRENT;
        return PendingIntent.getActivity(this, 0, open, pendingFlags);
    }

    private Notification buildNotification() {
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);

        builder.setSmallIcon(R.drawable.ic_stat_openfy)
            .setContentTitle(title.isEmpty() ? getString(R.string.playback_notification_title) : title)
            .setContentText(artist.isEmpty() ? getString(R.string.playback_notification_text) : artist)
            .setContentIntent(openAppIntent())
            .setCategory(Notification.CATEGORY_TRANSPORT)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOngoing(playing)
            .setOnlyAlertOnce(true)
            .addAction(new Notification.Action.Builder(
                android.R.drawable.ic_media_previous, getString(R.string.playback_previous), serviceIntent(ACTION_PREV, 1)).build())
            .addAction(new Notification.Action.Builder(
                playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                getString(playing ? R.string.playback_pause : R.string.playback_play),
                serviceIntent(ACTION_TOGGLE, 2)).build())
            .addAction(new Notification.Action.Builder(
                android.R.drawable.ic_media_next, getString(R.string.playback_next), serviceIntent(ACTION_NEXT, 3)).build());

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) builder.setPriority(Notification.PRIORITY_LOW);
        if (artwork != null) builder.setLargeIcon(artwork);
        if (session != null) {
            builder.setStyle(new Notification.MediaStyle()
                .setMediaSession(session.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2));
        }
        return builder.build();
    }

    private void startForegroundCompat(Notification notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }
}

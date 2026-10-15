import { currentTrack, usePlayer } from '../player'
import { useLibrary } from '../library'
import { Icon } from './Icon'

export function NowPanel() {
  const track = usePlayer(currentTrack)
  const liked = useLibrary((s) => (track ? s.liked.includes(track.id) : false))

  return (
    <aside className="np">
      <div className="np-inner">
        <div className="np-title">Tocando agora</div>
        <div className="np-media">
          {track?.cover ? (
            <img src={track.cover} alt="" />
          ) : (
            <div className="np-ph"><Icon name="music" size={64} /></div>
          )}
        </div>
        {track && (
          <div className="np-info">
            <div className="np-text">
              <div className="np-track">{track.title}</div>
              <div className="np-artist">{track.artist}</div>
            </div>
            <button
              className={'icon-btn' + (liked ? ' on' : '')}
              title={liked ? 'Remover das músicas salvas' : 'Salvar'}
              onClick={() => useLibrary.getState().toggleLike(track)}
            >
              <Icon name="heart" size={22} outline={!liked} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

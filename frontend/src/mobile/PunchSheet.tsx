import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, MapPin, RefreshCw, TimerReset, X } from 'lucide-react'
import { clock, dmy, duration, hrApi, locate, type AttendanceStatus, type DevicePlace } from '../lib/hr'
import { PUNCH_EVENT } from '../components/PunchButton'

/** Smaller photo: enough to see the face, small enough for a weak signal */
const MAX_SIDE = 640

/** Check in / out from the phone: location and a front-camera photo */
export function PunchSheet({ status, seconds, onClose }: { status: AttendanceStatus; seconds: number; onClose: () => void }) {
  const out = status.checked_in
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [camera, setCamera] = useState<'starting' | 'live' | 'failed'>('starting')
  const [cameraProblem, setCameraProblem] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [place, setPlace] = useState<DevicePlace | null>(null)
  const [looking, setLooking] = useState(true)
  const [placeProblem, setPlaceProblem] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async () => {
    setCamera('starting')
    setCameraProblem('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('This phone browser cannot use the camera here.')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } }, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
      setCamera('live')
    } catch (e) {
      const name = (e as DOMException).name
      setCameraProblem(name === 'NotAllowedError'
        ? 'The camera is blocked for this app. Allow it in the phone settings, or check in with a note.'
        : (e as Error).message || 'The camera could not start.')
      setCamera('failed')
    }
  }, [])

  const findPlace = useCallback(() => {
    setLooking(true)
    setPlaceProblem('')
    locate().then(setPlace).catch((e: Error) => setPlaceProblem(e.message)).finally(() => setLooking(false))
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void startCamera()
    findPlace()
    return stopCamera
  }, [startCamera, findPlace, stopCamera])

  const take = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Mirror back, so the saved photo is not reversed
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    setPhoto(canvas.toDataURL('image/jpeg', 0.72))
    stopCamera()
  }

  const retake = () => {
    setPhoto(null)
    void startCamera()
  }

  // A photo is needed; without a working camera a note says why
  const needsNote = camera === 'failed' && !photo
  const canSave = !saving && !looking && (photo !== null || (needsNote && note.trim() !== '')) && (out || place !== null || note.trim() !== '')

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await hrApi.punch({
        action: out ? 'out' : 'in',
        ...(place ?? {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(photo ? { selfie: photo } : {}),
      })
      window.dispatchEvent(new Event(PUNCH_EVENT))
      if ('vibrate' in navigator) navigator.vibrate(40)
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="m-sheet-backdrop" role="dialog" aria-modal="true" aria-label={out ? 'Check out' : 'Check in'}>
      <div className="m-sheet">
        <div className="m-sheet__head">
          <div>
            <h2>{out ? 'Check out' : 'Check in'}</h2>
            <p>{dmy(status.date)}{status.spells.length ? ` · ${duration(seconds)} today` : ''}</p>
          </div>
          <button type="button" className="m-icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        <div className="m-sheet__body">
          {status.forgot_on && !out ? (
            <p className="m-note m-note--warn"><TimerReset size={16} /> <span>You did not check out on {dmy(status.forgot_on)}. Ask for a correction in My Attendance if the time is wrong.</span></p>
          ) : null}
          {status.spells.length ? <p className="m-muted">Today: {status.spells.map((s) => `${clock(s.check_in_at)} – ${s.check_out_at ? clock(s.check_out_at) : 'now'}`).join(', ')}</p> : null}

          <div className="m-camera">
            {photo ? <img src={photo} alt="Your photo" /> : <video ref={videoRef} playsInline muted autoPlay />}
            {camera === 'starting' && !photo ? <span className="m-camera__msg">Starting camera…</span> : null}
            {camera === 'failed' && !photo ? <span className="m-camera__msg">{cameraProblem}</span> : null}
          </div>
          <div className="m-row-buttons">
            {photo ? (
              <button type="button" className="m-btn m-btn--ghost" onClick={retake}><RefreshCw size={16} /> Retake</button>
            ) : camera === 'failed' ? (
              <button type="button" className="m-btn m-btn--ghost" onClick={() => void startCamera()}><RefreshCw size={16} /> Try camera again</button>
            ) : (
              <button type="button" className="m-btn m-btn--ghost" onClick={take} disabled={camera !== 'live'}><Camera size={16} /> Take photo</button>
            )}
          </div>

          <p className={`m-note ${place ? 'm-note--ok' : placeProblem ? 'm-note--warn' : ''}`}>
            <MapPin size={16} />
            <span>{looking ? 'Finding your location…' : place ? `Location found (within about ${place.accuracy} m).` : placeProblem}</span>
            {!looking && !place ? <button type="button" className="m-link" onClick={findPlace}>Try again</button> : null}
          </p>

          <label className="m-field">
            <span>{needsNote ? 'Why no photo? (needed)' : !out && !place && !looking ? 'Where are you working today? (needed without location)' : 'Note (optional), e.g. site name'}</span>
            <input maxLength={250} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {error ? <p className="m-error" role="alert">{error}</p> : null}
        </div>

        <div className="m-sheet__foot">
          <button type="button" className={`m-btn m-btn--block ${out ? 'm-btn--danger' : 'm-btn--primary'}`} disabled={!canSave} onClick={() => void save()}>
            {saving ? 'Saving…' : out ? 'Check Out' : 'Check In'}
          </button>
        </div>
      </div>
    </div>
  )
}

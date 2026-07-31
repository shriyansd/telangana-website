// Speaking practice: listen to the model, record yourself, compare, repeat.
// Recordings never leave the device and are discarded when the exercise ends.
// Optional experimental transcription via the browser's Web Speech API.

import { useEffect, useRef, useState } from 'react';
import type { SpeakingExercise } from '../../types/content';
import type { TransliterationMode } from '../../types/progress';
import { AudioButton, TeluguText } from '../ui';
import { recorderSupported, startRecording, playBlob, RecorderHandle } from '../../lib/recorder';
import { getSpeechRecognizer, speechRecognitionSupported } from '../../lib/speech';
import { getSettings } from '../../lib/storage';

export function Speaking({
  exercise,
  translit,
  onDone,
}: {
  exercise: SpeakingExercise;
  translit: TransliterationMode;
  onDone: () => void;
}) {
  const [state, setState] = useState<'idle' | 'recording' | 'recorded' | 'playing'>('idle');
  const [recording, setRecording] = useState<Blob | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const handle = useRef<RecorderHandle | null>(null);

  const supported = recorderSupported();
  const settings = getSettings();

  useEffect(() => {
    setRecording(null); setState('idle'); setTranscript(null); setMicError(null);
  }, [exercise]);

  // Discard the recording from memory when leaving the exercise.
  useEffect(() => () => { setRecording(null); }, [exercise]);

  const record = async () => {
    setMicError(null);
    try {
      handle.current = await startRecording();
      setState('recording');
    } catch {
      setMicError('Microphone unavailable or permission denied. You can still practice out loud and continue.');
    }
  };

  const stop = async () => {
    if (!handle.current) return;
    const blob = await handle.current.stop();
    handle.current = null;
    setRecording(blob);
    setState('recorded');
  };

  const playMine = async () => {
    if (!recording) return;
    setState('playing');
    await playBlob(recording);
    setState('recorded');
  };

  const tryTranscribe = async () => {
    const rec = getSpeechRecognizer();
    if (!rec) return;
    setListening(true);
    setTranscript(null);
    const text = await rec.listen('te-IN');
    setListening(false);
    setTranscript(text ?? '(nothing recognized: that does not mean you were wrong!)');
  };

  return (
    <div className="speaking-exercise">
      <TeluguText value={exercise.model} mode={translit} showEnglish size="lg" />
      <AudioButton audio={exercise.audio} telugu={exercise.model.telugu} size="lg" />

      {!supported && (
        <p className="mic-note">Recording isn't supported in this browser: practice out loud, then continue.</p>
      )}
      {micError && <p className="mic-note">{micError}</p>}

      {supported && (
        <div className="rec-controls">
          {state !== 'recording' ? (
            <button type="button" className="btn-record" onClick={record}>
              🎙️ {recording ? 'Record again' : 'Record yourself'}
            </button>
          ) : (
            <button type="button" className="btn-record recording" onClick={stop}>
              ⏹ Stop
            </button>
          )}
          {recording && state !== 'recording' && (
            <>
              <button type="button" className="btn-audio" onClick={playMine} disabled={state === 'playing'}>
                ▶️ My recording
              </button>
              <span className="rec-hint">Alternate between the model and yourself: match the rhythm.</span>
            </>
          )}
        </div>
      )}

      {settings.speechRecognition && speechRecognitionSupported() && (
        <div className="asr-box">
          <button type="button" className="btn-asr" onClick={tryTranscribe} disabled={listening}>
            {listening ? 'Listening…' : '🧪 Experimental: transcribe my speech'}
          </button>
          {transcript && <p className="asr-result" lang="te">Heard: {transcript}</p>}
          <p className="asr-note">
            A rough aid, not a pronunciation score. Your browser's speech service processes the audio.
          </p>
        </div>
      )}

      <p className="mic-privacy">Recordings stay on your device and are discarded after this exercise.</p>
      <button type="button" className="btn-check" onClick={onDone}>
        {recording ? 'Done, sounds good' : 'I practiced out loud'}
      </button>
    </div>
  );
}

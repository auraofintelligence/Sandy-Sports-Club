let activeCleanup = null;

export function setupRecording() {
  activeCleanup?.();

  const startButton = document.getElementById('record-start');
  const stopButton = document.getElementById('record-stop');
  const modeSelect = document.getElementById('record-mode');
  const consent = document.getElementById('record-consent');
  const status = document.getElementById('record-status');
  const preview = document.getElementById('record-preview');
  const downloads = document.getElementById('record-download');
  const notes = document.getElementById('meeting-notes');
  const transcript = document.getElementById('record-transcript');
  const importButton = document.getElementById('transcript-to-notes');
  if (!startButton || !stopButton || !modeSelect || !consent || !status) return;

  const Recorder = window.MediaRecorder;
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = Boolean(Recorder && navigator.mediaDevices?.getUserMedia);
  const speechDisclosure = Speech
    ? "Live transcription uses your browser's speech service. Audio may be sent to that provider and internet may be required."
    : 'Transcription service is not connected in this browser. You can still record and paste a transcript manually.';

  let disposed = false;
  let starting = false;
  let recording = false;
  let finishing = false;
  let session = 0;
  let stream = null;
  let recorder = null;
  let recognition = null;
  let speechRestart = null;
  let speechFailed = false;
  let downloadUrl = null;
  let lastImported = null;
  let speechStatus = speechDisclosure;

  function say(message) {
    if (!disposed) status.textContent = `${message} ${speechStatus}`;
  }

  function updateButtons() {
    if (disposed) return;
    startButton.disabled = !supported || !consent.checked || starting || recording || finishing;
    stopButton.disabled = !starting && !recording;
    modeSelect.disabled = starting || recording || finishing;
    if (importButton) {
      const text = transcript?.value.trim() || '';
      importButton.disabled = !notes || !text || text === lastImported;
    }
  }

  function stopTracks() {
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    if (preview) {
      preview.srcObject = null;
      preview.hidden = true;
    }
  }

  function stopSpeech() {
    clearTimeout(speechRestart);
    speechRestart = null;
    try { recognition?.stop(); } catch { /* It may already have ended. */ }
  }

  function brisbaneStamp(date) {
    const parts = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}-${values.hour}${values.minute}`;
  }

  function preferredMime(mode) {
    const candidates = mode === 'video'
      ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/mp4', 'video/webm']
      : ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];
    return candidates.find(type => Recorder.isTypeSupported?.(type)) || '';
  }

  function showDownload(chunks, actualMime, mode, startedAt) {
    if (disposed) return;
    const mime = actualMime || chunks.find(chunk => chunk.type)?.type || 'application/octet-stream';
    const blob = new Blob(chunks, { type: mime });
    if (!blob.size) {
      say('The browser produced an empty recording. Please try again. Your transcript is still available.');
      return;
    }
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(blob);
    const extension = mime.includes('mp4') ? 'mp4' : mime.includes('webm') ? 'webm' : mime.includes('ogg') ? 'ogg' : 'bin';
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `plfc-meeting-${mode}-${brisbaneStamp(startedAt)}.${extension}`;
    link.className = 'button button-primary';
    link.textContent = `Download ${mode} recording (${(blob.size / 1024 / 1024).toFixed(1)} MB)`;
    downloads?.replaceChildren(link);
    say('Recording stopped. Download the file before leaving this page. The transcript stays here for review.');
  }

  function startSpeech(token) {
    if (!Speech || !transcript) return;
    let service;
    try {
      service = new Speech();
      service.lang = 'en-AU';
      service.continuous = true;
      service.interimResults = true;
    } catch {
      speechStatus = `Browser transcription could not start. You can paste a transcript manually. ${speechDisclosure}`;
      say('Recording is continuing.');
      return;
    }
    recognition = service;
    let base = transcript.value.trimEnd();

    service.onstart = () => {
      if (disposed || token !== session || !recording) {
        try { service.stop(); } catch { /* Nothing is listening. */ }
        return;
      }
      speechStatus = `Browser speech transcription is listening. ${speechDisclosure}`;
      say('Recording is in progress.');
    };

    service.onresult = event => {
      if (disposed || token !== session) return;
      const finished = [];
      const interim = [];
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const words = result[0]?.transcript?.trim();
        if (words) (result.isFinal ? finished : interim).push(words);
      }
      transcript.value = [base, finished.join(' '), interim.join(' ')].filter(Boolean).join('\n\n');
      transcript.dispatchEvent(new Event('input', { bubbles: true }));
      updateButtons();
    };

    service.onerror = event => {
      if (disposed || token !== session || !recording) return;
      if (event.error === 'no-speech') return;
      speechFailed = true;
      clearTimeout(speechRestart);
      const reason = ['not-allowed', 'service-not-allowed'].includes(event.error)
        ? 'Browser speech permission was not granted.'
        : event.error === 'network'
          ? 'The browser speech service could not connect.'
          : 'Browser speech transcription stopped.';
      speechStatus = `${reason} Recording still works and you can paste a transcript manually. ${speechDisclosure}`;
      say('Recording is continuing.');
    };

    service.onend = () => {
      if (disposed || token !== session || !recording || speechFailed) return;
      speechRestart = setTimeout(() => {
        if (disposed || token !== session || !recording || speechFailed) return;
        base = transcript.value.trimEnd();
        try { service.start(); } catch {
          speechFailed = true;
          speechStatus = `Browser transcription could not resume. Paste a transcript manually if needed. ${speechDisclosure}`;
          say('Recording is continuing.');
        }
      }, 700);
    };

    try { service.start(); } catch {
      speechFailed = true;
      speechStatus = `Browser transcription could not start. You can paste a transcript manually. ${speechDisclosure}`;
      say('Recording is continuing.');
    }
  }

  async function start() {
    if (disposed || starting || recording || finishing) return;
    if (!consent.checked) {
      say('Confirm that participants know about and consent to recording before starting.');
      return;
    }
    if (!supported) {
      say('Recording needs HTTPS or localhost and a browser with microphone recording support.');
      return;
    }
    const mode = modeSelect.value === 'video' ? 'video' : 'audio';
    const token = ++session;
    const startedAt = new Date();
    starting = true;
    speechFailed = false;
    speechStatus = speechDisclosure;
    updateButtons();
    say(`Waiting for your browser to allow ${mode === 'video' ? 'camera and microphone' : 'microphone'} access.`);

    try {
      const captured = await navigator.mediaDevices.getUserMedia({ audio: true, video: mode === 'video' });
      if (disposed || token !== session || !consent.checked) {
        captured.getTracks().forEach(track => track.stop());
        if (!disposed && token === session) {
          starting = false;
          updateButtons();
          say('Recording did not start because participant consent is no longer confirmed.');
        }
        return;
      }
      stream = captured;
      const mimeType = preferredMime(mode);
      const nextRecorder = new Recorder(captured, mimeType ? { mimeType } : undefined);
      const chunks = [];
      recorder = nextRecorder;
      nextRecorder.ondataavailable = event => {
        if (!disposed && event.data?.size) chunks.push(event.data);
      };
      nextRecorder.onstop = () => {
        if (disposed || token !== session) return;
        recording = false;
        starting = false;
        finishing = false;
        stopSpeech();
        stopTracks();
        recorder = null;
        speechStatus = speechDisclosure;
        showDownload(chunks, nextRecorder.mimeType, mode, startedAt);
        updateButtons();
      };
      nextRecorder.onerror = () => {
        if (disposed || token !== session) return;
        stop();
        say('The browser reported a recording problem. Any captured file will be offered for download.');
      };
      nextRecorder.start(1000);
      starting = false;
      recording = true;
      if (preview && mode === 'video') {
        preview.hidden = false;
        preview.muted = true;
        preview.autoplay = true;
        preview.playsInline = true;
        preview.srcObject = captured;
        preview.play()?.catch(() => {});
      }
      updateButtons();
      say(`Recording ${mode}.`);
      startSpeech(token);
    } catch (error) {
      if (disposed || token !== session) return;
      starting = false;
      recording = false;
      finishing = false;
      stopSpeech();
      stopTracks();
      recorder = null;
      const message = ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(error?.name)
        ? 'Microphone or camera permission was not granted. Allow access in your browser and try again.'
        : error?.name === 'NotFoundError'
          ? 'The requested microphone or camera was not found. Check the device or choose audio only.'
          : ['NotReadableError', 'TrackStartError'].includes(error?.name)
            ? 'The microphone or camera could not be opened. Check whether another app is using it.'
            : 'Recording could not start in this browser. Check device permissions and try again.';
      say(message);
      updateButtons();
    }
  }

  function stop() {
    if (disposed) return;
    if (starting && !recording) {
      session += 1;
      starting = false;
      stopTracks();
      updateButtons();
      say('Start cancelled. Any pending device access will be released when the browser responds.');
      return;
    }
    if (!recording) return;
    recording = false;
    finishing = true;
    stopSpeech();
    try {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      else finishing = false;
    } catch {
      finishing = false;
      say('Recording stopped. The browser could not finish the file. Your transcript is still available.');
    }
    stopTracks();
    updateButtons();
    if (finishing) say('Stopping and preparing your recording for download.');
  }

  function consentChanged() {
    if (!consent.checked && (recording || starting)) stop();
    updateButtons();
  }

  function routeChanged() {
    if (window.location.hash !== '#committee' && (recording || starting)) stop();
  }

  function importTranscript() {
    const text = transcript?.value.trim();
    if (!notes || !text || text === lastImported) return;
    notes.value = [notes.value.trimEnd(), `## Meeting transcript\n\n${text}`].filter(Boolean).join('\n\n');
    notes.dispatchEvent(new Event('input', { bubbles: true }));
    lastImported = text;
    updateButtons();
    say('Transcript added to the meeting notes for review. Save the notes when ready.');
  }

  function cleanup() {
    if (disposed) return;
    disposed = true;
    session += 1;
    recording = false;
    stopSpeech();
    try { if (recorder?.state !== 'inactive') recorder?.stop(); } catch { /* Release devices below. */ }
    try { recognition?.abort(); } catch { /* It may already have ended. */ }
    stopTracks();
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    startButton.removeEventListener('click', start);
    stopButton.removeEventListener('click', stop);
    consent.removeEventListener('change', consentChanged);
    transcript?.removeEventListener('input', updateButtons);
    importButton?.removeEventListener('click', importTranscript);
    window.removeEventListener('beforeunload', cleanup);
    window.removeEventListener('pagehide', cleanup);
    window.removeEventListener('hashchange', routeChanged);
    if (activeCleanup === cleanup) activeCleanup = null;
  }

  startButton.addEventListener('click', start);
  stopButton.addEventListener('click', stop);
  consent.addEventListener('change', consentChanged);
  transcript?.addEventListener('input', updateButtons);
  importButton?.addEventListener('click', importTranscript);
  window.addEventListener('beforeunload', cleanup);
  window.addEventListener('pagehide', cleanup);
  window.addEventListener('hashchange', routeChanged);
  activeCleanup = cleanup;
  updateButtons();
  say(supported
    ? 'Ready. Choose audio or video, announce the recording and confirm participant consent.'
    : 'Recording needs HTTPS or localhost and a browser with microphone recording support.');
  return cleanup;
}

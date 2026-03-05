import { useCallback, useEffect, useRef, useState } from 'react'

const SILENCE_TIMEOUT_MS = 120_000
const SAMPLE_RATE = 16000
const SCRIPT_BUFFER_SIZE = 4096

export function useVoiceMode() {
  const [phase, setPhase] = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [responseText, setResponseText] = useState('')

  const isActiveRef = useRef(false)
  const audioCtxRef = useRef(null)
  const processorRef = useRef(null)
  const sourceRef = useRef(null)
  const micStreamRef = useRef(null)
  const silenceTimerRef = useRef(null)
  const playCtxRef = useRef(null)
  const playScheduleRef = useRef(0)
  const deactivateRef = useRef(null)

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = setTimeout(() => {
      if (isActiveRef.current) deactivateRef.current?.()
    }, SILENCE_TIMEOUT_MS)
  }, [])

  const stopMic = useCallback(() => {
    if (processorRef.current) {
      try {
        processorRef.current.disconnect()
      } catch (error) {
        void error
      }
      processorRef.current = null
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect()
      } catch (error) {
        void error
      }
      sourceRef.current = null
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop())
      micStreamRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
  }, [])

  const stopPlayback = useCallback(() => {
    playScheduleRef.current = 0
    if (playCtxRef.current) {
      playCtxRef.current.close().catch(() => {})
      playCtxRef.current = null
    }
  }, [])

  const deactivate = useCallback(async () => {
    if (!isActiveRef.current) return
    isActiveRef.current = false
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    stopMic()
    stopPlayback()
    setPhase('idle')
    setTranscript('')
    setResponseText('')
    try {
      await window.api.chat.setMode('text')
    } catch (error) {
      void error
    }
    try {
      await window.api.voice.sessionEnd()
    } catch (error) {
      void error
    }
  }, [stopMic, stopPlayback])

  useEffect(() => {
    deactivateRef.current = deactivate
  }, [deactivate])

  const playPcmBuffer = useCallback(
    async (buf) => {
      try {
        if (!playCtxRef.current || playCtxRef.current.state === 'closed') {
          playCtxRef.current = new AudioContext({ sampleRate: SAMPLE_RATE })
          playScheduleRef.current = playCtxRef.current.currentTime
        }
        const ctx = playCtxRef.current

        if (ctx.state === 'suspended') {
          await ctx.resume()
        }

        let int16
        if (buf instanceof ArrayBuffer) {
          int16 = new Int16Array(buf)
        } else if (ArrayBuffer.isView(buf)) {
          const clean = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
          int16 = new Int16Array(clean)
        } else {
          console.warn('[voice] playPcmBuffer: unexpected buf type', typeof buf)
          return
        }

        if (int16.length === 0) return

        const float32 = new Float32Array(int16.length)
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / 32768.0
        }
        const audioBuffer = ctx.createBuffer(1, float32.length, SAMPLE_RATE)
        audioBuffer.copyToChannel(float32, 0)
        const source = ctx.createBufferSource()
        source.buffer = audioBuffer
        source.connect(ctx.destination)
        const startAt = Math.max(ctx.currentTime, playScheduleRef.current)
        source.start(startAt)
        playScheduleRef.current = startAt + audioBuffer.duration
        resetSilenceTimer()
      } catch (err) {
        console.error('[voice] playPcmBuffer error:', err)
      }
    },
    [resetSilenceTimer]
  )

  const activate = useCallback(async () => {
    if (isActiveRef.current) return
    isActiveRef.current = true
    setPhase('listening')
    setTranscript('')
    setResponseText('')

    try {
      await window.api.voice.sessionStart()
      await window.api.chat.setMode('voice')
    } catch {
      isActiveRef.current = false
      setPhase('idle')
      return
    }

    try {
      if (!playCtxRef.current || playCtxRef.current.state === 'closed') {
        playCtxRef.current = new AudioContext({ sampleRate: SAMPLE_RATE })
        playScheduleRef.current = playCtxRef.current.currentTime
      }
    } catch (error) {
      void error
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      micStreamRef.current = stream

      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
      audioCtxRef.current = ctx

      const source = ctx.createMediaStreamSource(stream)
      sourceRef.current = source

      const processor = ctx.createScriptProcessor(SCRIPT_BUFFER_SIZE, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        if (!isActiveRef.current) return
        const float32 = e.inputBuffer.getChannelData(0)
        const int16 = new Int16Array(float32.length)
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]))
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
        }
        window.api.voice.sendAudio(int16.buffer).catch(() => {})
        resetSilenceTimer()
      }

      source.connect(processor)
      processor.connect(ctx.destination)
      resetSilenceTimer()
    } catch {
      deactivate()
    }
  }, [deactivate, resetSilenceTimer])

  const dismiss = useCallback(() => {
    deactivate()
  }, [deactivate])

  useEffect(() => {
    const unsubActivate = window.api.voice.onActivate(() => {
      activate()
    })

    const unsubAudio = window.api.voice.onAudio((buf) => {
      if (!isActiveRef.current) return
      setPhase('speaking')
      playPcmBuffer(buf)
    })

    return () => {
      unsubActivate()
      unsubAudio()
    }
  }, [activate, playPcmBuffer])

  useEffect(() => {
    const unsubEvent = window.api.chat.onEvent((event) => {
      if (!isActiveRef.current) return

      if (event.type === 'transcript' && event.data?.content) {
        setTranscript(event.data.content)
        setPhase('thinking')
        setResponseText('')
        resetSilenceTimer()
      }

      if (event.type === 'message_chunk' && event.data?.content) {
        setResponseText((prev) => prev + event.data.content)
        resetSilenceTimer()
      }

      if (event.type === 'audio_start') {
        setPhase('speaking')
      }

      if (event.type === 'audio_end') {
        setPhase('listening')
        setResponseText('')
        resetSilenceTimer()
      }

      if (event.type === 'barge_in') {
        stopPlayback()
        setPhase('listening')
        setResponseText('')
      }
    })

    return () => unsubEvent()
  }, [resetSilenceTimer, stopPlayback])

  useEffect(() => {
    return () => {
      isActiveRef.current = false
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      stopMic()
      stopPlayback()
    }
  }, [stopMic, stopPlayback])

  return {
    phase,
    transcript,
    responseText,
    isActive: phase !== 'idle',
    activate,
    dismiss
  }
}

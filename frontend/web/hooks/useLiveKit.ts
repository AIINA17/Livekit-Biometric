// hooks/useLiveKit.ts
'use client';

import { useState, useRef, useCallback } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { AgentCommand, Product, VerificationResult } from '@/types';

interface UseLiveKitProps {
  token: string | null;
  onMessage: (role: "user" | "assistant", text: string) => void;
  onProductCards: (products: Product[]) => void;
  onVerifyStatus: (status: string) => void;
  onRoomStatus: (status: string) => void;
  onScore: (score: number | null) => void;
  onAgentSpeaking: (speaking: boolean) => void;
}

export function useLiveKit({
  token,
  onMessage,
  onProductCards,
  onVerifyStatus,
  onRoomStatus,
  onScore,
  onAgentSpeaking,
}: UseLiveKitProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [agentReady, setAgentReady] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  const tokenRef = useRef<string | null>(token);
  tokenRef.current = token;
  
  const sendForVerificationRef = useRef<
    ((chunks: Blob[]) => Promise<void>) | null
  >(null);

  const roomRef = useRef<Room | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;
  const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  // Handle agent commands from data channel
  const handleAgentCommand = useCallback((payload: Uint8Array, topic?: string) => {
    const decoder = new TextDecoder();
    const strData = decoder.decode(payload);

    if (!strData || strData.trim().length < 2) {
      console.warn('⚠️ Ignoring empty/invalid agent payload');
      return;
    }

    const clean = strData.trim();
    console.log('📩 DATA FROM AGENT (first 200 chars):', clean.substring(0, 200));

    if (clean[0] !== '{') {
      console.warn('⚠️ Non-JSON agent payload ignored');
      return;
    }

    let msg: AgentCommand;
    try {
      msg = JSON.parse(clean);
      console.log('✅ JSON parsed successfully');
      console.log('  - Type:', msg.type);
    } catch (e) {
      console.error('❌ JSON parse failed:', e);
      return;
    }

    // Handle Product Cards
    if (msg.type === 'PRODUCT_CARDS' && msg.products) {
      console.log(`🛍️ Received ${msg.products.length} products`);
      onProductCards(msg.products);
      return;
    }

    // Handle Voice Commands
    if (msg.type === 'VOICE_CMD' && msg.action) {
      console.log('📦 VOICE_CMD detected - Action:', msg.action);

      if (msg.action === 'START_RECORD') {
        // 🔐 GUARD AUTH TOKEN
        if (!tokenRef.current) {
          console.warn('⚠️ START_RECORD blocked: user not logged in');
          onVerifyStatus('❌ Login dulu sebelum verifikasi suara');
          return;
        }

        startVADRecording();
      }

      else if (msg.action === 'STOP_RECORD') {
        stopRecording();
      }

      return;
    }

    // Handle other message types
    if (msg.type === 'AGENT_MESSAGE' && msg.text) {
      setIsTyping(false);
      onMessage('assistant', msg.text);
      return;
    }

    if (msg.type === 'AGENT_THINKING') {
      setIsTyping(true);
      return;
    }

    if (msg.type === 'TRANSCRIPTION' && msg.text) {
      if (msg.role === 'user') {
        onMessage('user', msg.text);
      } else if (msg.role === 'assistant') {
        setIsTyping(false);
        onMessage('assistant', msg.text);
      }
      return;
    }

    console.log('ℹ️ Unhandled message type:', msg.type);
}, [token, onMessage, onProductCards, onVerifyStatus]);

  // VAD Recording
  const startVADRecording = useCallback(async () => {
    console.log('🎯 startVADRecording() called');

    if (recorderRef.current && recorderRef.current.state === 'recording') {
      console.warn('⚠️ Recording already in progress');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.fftSize);
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorderRef.current = recorder;
      chunksRef.current = chunks;

      let isRecording = false;
      let silenceStart: number | null = null;
      let checkInterval: number | null = null;

      const START_THRESHOLD = 0.01;
      const STOP_THRESHOLD = 0.005;
      const SILENCE_DELAY_MS = 1200;
      const MAX_DURATION = 6000;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        console.log('🛑 Recording stopped');
        
        if (checkInterval) {
          cancelAnimationFrame(checkInterval);
        }

        if (chunks.length > 0) {
          await sendForVerificationRef.current?.(chunks);
        } else {
          onVerifyStatus('⚠️ Tidak ada suara terdeteksi');
        }

        stream.getTracks().forEach((t) => t.stop());
        audioContext.close();
      };

      const startTime = performance.now();

      function check() {
        analyser.getByteTimeDomainData(buffer);

        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          const v = (buffer[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buffer.length);

        if (!isRecording && rms > START_THRESHOLD) {
          console.log(`🎙️ Voice detected (RMS: ${rms.toFixed(4)}) → START`);
          recorder.start();
          isRecording = true;
          silenceStart = null;
          onVerifyStatus('🎙️ Mendengarkan...');
        }

        if (isRecording) {
          if (rms < STOP_THRESHOLD) {
            if (!silenceStart) {
              silenceStart = performance.now();
            }

            const silenceDuration = performance.now() - silenceStart;
            if (silenceDuration > SILENCE_DELAY_MS) {
              console.log(`✅ Silence duration: ${silenceDuration.toFixed(0)}ms → STOP`);
              recorder.stop();
              return;
            }
          } else {
            silenceStart = null;
          }
        }

        const elapsed = performance.now() - startTime;
        if (elapsed > MAX_DURATION) {
          console.warn(`⏱️ Max duration reached → FORCE STOP`);
          if (recorder.state === 'recording') {
            recorder.stop();
          }
          return;
        }

        checkInterval = requestAnimationFrame(check) as unknown as number;
      }

      onVerifyStatus('🎧 Silakan bicara...');
      check();
    } catch (err) {
      console.error('❌ Failed to start VAD recording:', err);
      onVerifyStatus('❌ Mic access failed');
    }
  }, [onVerifyStatus]);

  // Send for verification
  const sendForVerification = useCallback(async (chunks: Blob[]) => {
    sendForVerificationRef.current = sendForVerification;
    if (!tokenRef.current) {
      console.error('❌ No auth token available');
      onVerifyStatus('❌ Login dulu sebelum verifikasi');
      return;
    }
    const blob = new Blob(chunks, { type: 'audio/wav' });
    const form = new FormData();
    form.append('audio', blob, 'voice.wav');

    onVerifyStatus('🔍 Verifying...');

    try {
      const res = await fetch(`${SERVER_URL}/verify-voice`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenRef.current}`,
        },
        body: form,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result: VerificationResult = await res.json();
      console.log('📊 Verification result:', result);

      onScore(result.score);
      onVerifyStatus(result.verified ? '✅ Verified' : '❌ Verification failed');

      if (!agentReady || !roomRef.current) {
        console.warn('⚠️ Agent not ready, skipping data send');
        return;
      }

      const payload = JSON.stringify({
        type: 'VOICE_RESULT',
        voice_verified: result.verified,
        decision: result.status,
        score: result.score,
        spoof_prob: result.spoof_prob,
        ts: Date.now(),
      });

      await roomRef.current.localParticipant.publishData(
        new TextEncoder().encode(payload),
        { reliable: true }
      );

      console.log('📤 Sent verification result to agent');
    } catch (err) {
      console.error('❌ Verification error:', err);
      onVerifyStatus(`❌ Error: ${err}`);
    }
  }, [token, agentReady, onScore, onVerifyStatus, SERVER_URL]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
  }, []);

  // Join Room
  const joinRoom = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER_URL}/join-token`, {
        method: 'POST',
      });

      const data = await res.json();
      console.log('JOIN TOKEN:', data);

      if (!data.token) {
        onRoomStatus('❌ Gagal mendapatkan token.');
        return;
      }

      // Create room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      roomRef.current = room;

      // Room events
      room.on(RoomEvent.Connected, () => {
        console.log('✅ Connected to LiveKit room');
        onRoomStatus('✅ Connected to LiveKit room.');
        setIsConnected(true);
      });

      room.on(RoomEvent.Disconnected, () => {
        console.log('❌ Disconnected from room');
        onRoomStatus('❌ Disconnected from LiveKit room.');
        setIsConnected(false);
        stopRecording();
      });

      room.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log('👤 Participant joined:', participant.identity);
        setAgentReady(true);
        onRoomStatus('🤖 Agent siap, silakan verifikasi suara');
      });

      room.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
        handleAgentCommand(payload, topic);
      });

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const audioElement = track.attach();
          document.body.appendChild(audioElement);

          // Audio visualization
          const audioContext = new AudioContext();
          const source = audioContext.createMediaStreamSource(
            new MediaStream([track.mediaStreamTrack])
          );
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          function checkVolume() {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
            let average = sum / bufferLength;

            onAgentSpeaking(average > 5);
            requestAnimationFrame(checkVolume);
          }
          checkVolume();

          audioElement.play().catch((e) => console.error('Audio play error:', e));
        }
      });

      room.on(RoomEvent.TranscriptionReceived, (transcriptions, participant, publication) => {
        transcriptions.forEach((segment) => {
          if (segment.final && segment.text && segment.text.trim() !== '') {
            const isAgent =
              participant &&
              (participant.identity === 'agent' ||
                participant.identity.includes('agent') ||
                participant.sid !== room.localParticipant.sid);

            if (isAgent) {
              setIsTyping(false);
              onMessage('assistant', segment.text.trim());
            } else {
              onMessage('user', segment.text.trim());
            }
          } else if (!segment.final && segment.text) {
            const isAgent = participant && participant.sid !== room.localParticipant.sid;
            if (isAgent) {
              setIsTyping(true);
            }
          }
        });
      });

      // Connect
      await room.connect(LIVEKIT_URL!, data.token);
      console.log('Connected to room');

      if (room.remoteParticipants.size > 0) {
        console.log(`✅ Found ${room.remoteParticipants.size} existing participant(s)`);
        setAgentReady(true);
        onRoomStatus('🤖 Agent terdeteksi, silakan verifikasi suara');
      }

      // Publish local audio
      const track = await import('livekit-client').then((m) => m.createLocalAudioTrack());
      await room.localParticipant.publishTrack(track);

      onRoomStatus('✅ Joined room, menunggu agent...');
    } catch (err) {
      console.error(err);
      onRoomStatus('❌ Server tidak bisa diakses.');
    }
  }, [
    SERVER_URL,
    LIVEKIT_URL,
    onRoomStatus,
    onMessage,
    onAgentSpeaking,
    handleAgentCommand,
    stopRecording,
  ]);

  // Leave Room
  const leaveRoom = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      onRoomStatus('❌ Left LiveKit room.');
      setIsConnected(false);
      stopRecording();
    }
  }, [onRoomStatus, stopRecording]);

  return {
    isConnected,
    isTyping,
    joinRoom,
    leaveRoom,
  };
}
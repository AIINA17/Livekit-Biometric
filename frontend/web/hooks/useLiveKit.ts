// hooks/useLiveKit.ts
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
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
  
  // Use ref untuk token agar selalu update tanpa re-create callbacks
  const tokenRef = useRef<string | null>(token);
  
  // Update tokenRef when token changes
  useEffect(() => {
    tokenRef.current = token;
    console.log('🔑 Token updated:', token ? 'SET' : 'NULL');
  }, [token]);

  const roomRef = useRef<any | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Validate environment variables
  const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;
  const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  // Check if required env vars are set
  if (!SERVER_URL) {
    console.error('❌ NEXT_PUBLIC_SERVER_URL is not defined in .env.local');
  }
  if (!LIVEKIT_URL) {
    console.error('❌ NEXT_PUBLIC_LIVEKIT_URL is not defined in .env.local');
  }

  // Send for verification - defined early so it can be referenced
  const sendForVerification = useCallback(async (chunks: Blob[]) => {
    console.log('📤 sendForVerification called');
    console.log('🔑 Current token:', tokenRef.current ? 'SET' : 'NULL');
    
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
      console.log('📡 Sending to:', `${SERVER_URL}/verify-voice`);
      
      const res = await fetch(`${SERVER_URL}/verify-voice`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenRef.current}`,
        },
        body: form,
      });

      console.log('📥 Verification response status:', res.status);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result: VerificationResult = await res.json();
      console.log('📊 Verification result:', result);

      onScore(result.score);
      onVerifyStatus(result.verified ? '✅ Verified' : '❌ Verification failed');

      // Send to agent with retry logic
      const sendDataToAgent = async (maxRetries = 5) => {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            if (!roomRef.current || !roomRef.current.localParticipant) {
              console.log(`⚠️ Room not ready (attempt ${attempt + 1}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, 500));
              continue;
            }

            const payload = JSON.stringify({
              type: 'VOICE_RESULT',
              decision: result.decision || result.status,
              score: result.score,
              spoof_prob: result.spoof_prob,
              reason: result.reason,
              best_label: result.best_label,
              verified: result.verified,
              ts: Date.now(),
            });

            await roomRef.current.localParticipant.publishData(
              new TextEncoder().encode(payload),
              { reliable: true, topic: 'VOICE_RESULT' }
            );

            console.log('✅ Data sent to agent successfully');
            return true;
          } catch (error) {
            console.error(`❌ Failed to send (attempt ${attempt + 1}):`, error);
            
            if (attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
        
        console.error('❌ Failed to send data after all retries');
        return false;
      };

      // Execute send with retry
      const sent = await sendDataToAgent();
      if (!sent) {
        console.warn('⚠️ Failed to notify agent of verification result');
      }

    } catch (err) {
      console.error('❌ Verification error:', err);
      onVerifyStatus(`❌ Error: ${err}`);
    }
  }, [onScore, onVerifyStatus, SERVER_URL]);

  // VAD Recording
  const startVADRecording = useCallback(async () => {
    console.log('🎯 startVADRecording() called');
    console.log('🔑 Token check:', tokenRef.current ? 'SET' : 'NULL');

    if (!tokenRef.current) {
      console.warn('⚠️ Cannot start recording: user not logged in');
      onVerifyStatus('❌ Login dulu sebelum verifikasi suara');
      return;
    }

    if (recorderRef.current && recorderRef.current.state === 'recording') {
      console.warn('⚠️ Recording already in progress');
      return;
    }

    try {
      console.log('🎤 Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('✅ Microphone access granted');

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
          console.log(`📦 Audio chunk: ${e.data.size} bytes`);
        }
      };

      recorder.onstop = async () => {
        console.log('🛑 Recording stopped');
        console.log(`📊 Total chunks: ${chunks.length}`);
        
        if (checkInterval) {
          cancelAnimationFrame(checkInterval);
        }

        if (chunks.length > 0) {
          console.log('✅ Sending audio for verification...');
          await sendForVerification(chunks);
        } else {
          console.warn('⚠️ No audio data recorded');
          onVerifyStatus('⚠️ Tidak ada suara terdeteksi');
        }

        stream.getTracks().forEach((t) => t.stop());
        audioContext.close();
      };

      const startTime = performance.now();
      let frameCount = 0;

      function check() {
        analyser.getByteTimeDomainData(buffer);

        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          const v = (buffer[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buffer.length);

        frameCount++;
        if (frameCount % 30 === 0) {
          console.log(`📊 RMS: ${rms.toFixed(4)} | Recording: ${isRecording}`);
        }

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
      console.log('👂 Starting VAD check loop...');
      check();
    } catch (err) {
      console.error('❌ Failed to start VAD recording:', err);
      onVerifyStatus('❌ Mic access failed');
    }
  }, [onVerifyStatus, sendForVerification]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
  }, []);

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
        console.log('🔐 Checking token before recording...');
        console.log('🔑 Token:', tokenRef.current ? 'SET' : 'NULL');
        
        if (!tokenRef.current) {
          console.warn('⚠️ START_RECORD blocked: user not logged in');
          onVerifyStatus('❌ Login dulu sebelum verifikasi suara');
          return;
        }

        startVADRecording();
      } else if (msg.action === 'STOP_RECORD') {
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
  }, [onMessage, onProductCards, onVerifyStatus, startVADRecording, stopRecording]);

  // Join Room
  const joinRoom = useCallback(async () => {
    try {
      // Validate environment variables
      if (!SERVER_URL) {
        onRoomStatus('❌ SERVER_URL not configured. Check .env.local');
        console.error('Missing NEXT_PUBLIC_SERVER_URL in .env.local');
        return;
      }

      if (!LIVEKIT_URL) {
        onRoomStatus('❌ LIVEKIT_URL not configured. Check .env.local');
        console.error('Missing NEXT_PUBLIC_LIVEKIT_URL in .env.local');
        return;
      }

      console.log('📡 Requesting join token with room: mainroom');
      
      const res = await fetch(`${SERVER_URL}/join-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ room: "mainroom" }),
      });

      const data = await res.json();
      console.log('JOIN TOKEN:', data);

      if (!data.token) {
        onRoomStatus('❌ Gagal mendapatkan token.');
        return;
      }

      // Import LiveKit dynamically (Fix untuk Next.js)
      const { Room, RoomEvent, Track, createLocalAudioTrack } = await import('livekit-client');

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
        setAgentReady(false);
        stopRecording();
      });

      room.on(RoomEvent.ParticipantConnected, (participant: any) => {
        console.log('👤 Participant joined:', participant.identity);
        setAgentReady(true);
        onRoomStatus('🤖 Agent siap, silakan verifikasi suara');
      });

      room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant: any, kind: any, topic: any) => {
        handleAgentCommand(payload, topic);
      });

      room.on(RoomEvent.TrackSubscribed, (track: any, publication: any, participant: any) => {
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

          audioElement.play().catch((e: any) => console.error('Audio play error:', e));
        }
      });

      room.on(RoomEvent.TranscriptionReceived, (transcriptions: any, participant: any, publication: any) => {
        transcriptions.forEach((segment: any) => {
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
      console.log('🔌 Connecting to:', LIVEKIT_URL);
      await room.connect(LIVEKIT_URL, data.token);
      console.log('✅ Connected to room');

      if (room.remoteParticipants.size > 0) {
        console.log(`✅ Found ${room.remoteParticipants.size} existing participant(s)`);
        setAgentReady(true);
        onRoomStatus('🤖 Agent terdeteksi, silakan verifikasi suara');
      }

      // Publish local audio
      const track = await createLocalAudioTrack();
      await room.localParticipant.publishTrack(track);

      onRoomStatus('✅ Joined room, menunggu agent...');
    } catch (err) {
      console.error('❌ Join room error:', err);
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
      setAgentReady(false);
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
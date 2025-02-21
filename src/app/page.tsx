"use client";

import { useState, useEffect, useRef } from "react";

const Home = () => {
  const [seconds, setSeconds] = useState(0);
  const [callStatus, setCallStatus] = useState("Initializing...");
  const ringBoxRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<HTMLDivElement | null>(null);
  const endCallBtnRef = useRef<HTMLButtonElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const [, setEphemeralKey] = useState<string | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);

  const startRingtone = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.loop = true;
      ringtoneRef.current.play().catch((error) => console.error("Ringtone error:", error));
    }
  };

  const stopRingtone = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
  };

  const startTimer = () => {
    stopRingtone();
    setSeconds(0);
    const intervalId = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    setTimerInterval(intervalId);
  };

  const stopTimer = () => {
    if (timerInterval !== null) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    setSeconds(0);
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(
      2,
      "0"
    )}:${String(secs).padStart(2, "0")}`;
  };

  const formatCallSummary = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    let summary = "Call Duration: ";
    if (hours > 0) summary += `${hours}h `;
    if (minutes > 0) summary += `${minutes}m `;
    summary += `${remainingSeconds}s`;
    return summary;
  };

  const endCall = () => {
    stopRingtone();
    stopTimer();
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (ringBoxRef.current && endCallBtnRef.current) {
      const summary = formatCallSummary(seconds);
      setCallStatus(summary);

      endCallBtnRef.current.style.display = "none";

      setTimeout(() => {
        if (ringBoxRef.current) {
          ringBoxRef.current.style.display = "none";
        }
        setCallStatus("Ready to call");
      }, 3000);
    }
  };
//   const fns: Record<
//   string,
//   (args: { color1: string; color2: string }) => { success: boolean; color1: string; color2: string }
// > = {
//   changeBackgroundColor: ({ color1, color2 }) => {
//     if (ringBoxRef.current) {
//       ringBoxRef.current.style.background = `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`;
//     } else {
//       console.warn("Element with ID 'ringBox' not found.");
//       return { success: false, color1, color2 };
//     }
//     return { success: true, color1, color2 };
//   },
// };

  const initOpenAIRealtime = async () => {
    try {
      setCallStatus("Ringing...");
      if (ringBoxRef.current) ringBoxRef.current.style.display = "block";
      if (endCallBtnRef.current) endCallBtnRef.current.style.display = "none";
      startRingtone();

      const tokenResponse = await fetch("http://127.0.0.1:5000/session");
      const data = await tokenResponse.json();

      const clientSecret = data.client_secret.value;
      setEphemeralKey(clientSecret);

      const peerConnection = new RTCPeerConnection();
      peerConnectionRef.current = peerConnection;

      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === "connected") {
          stopRingtone();
          setCallStatus("Connected");
          if (timerRef.current) timerRef.current.style.display = "block";
          startTimer();
          if (endCallBtnRef.current) endCallBtnRef.current.style.display = "block";
        }
      };

      const audioElement = document.createElement("audio");
      audioElement.autoplay = true;
      peerConnection.ontrack = (event) => {
        audioElement.srcObject = event.streams[0];
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      peerConnection.addTrack(mediaStream.getTracks()[0]);

      const dataChannel = peerConnection.createDataChannel("response");
      dataChannelRef.current = dataChannel;

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const apiUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-realtime-preview-2024-12-17";

      const sdpResponse = await fetch(`${apiUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          "Content-Type": "application/sdp",
        },
      });

      const answer: RTCSessionDescriptionInit = {
        type: "answer",
        sdp: await sdpResponse.text(),
      };
      await peerConnection.setRemoteDescription(answer);
    } catch (error) {
      console.error("Error:", error);
      endCall();
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      ringtoneRef.current = new Audio("/beep.mp3");
    }
  }, []);

  return (
    <div>
      <div ref={ringBoxRef} id="ringBox" style={{ display: "none" }}>
        <div className="ring-content">
          <div className="wave"></div>
          <div className="wave animate-bounce animation-delay-600"></div>
          <div className="wave animate-bounce animation-delay-1200"></div>
          <div className="call-status">{callStatus}</div>
          <div ref={timerRef} className="timer" style={{ display: "none" }}>
            {formatTime(seconds)}
          </div>
          <div className="loader hidden">Sending message...</div>
          <button ref={endCallBtnRef} id="endCallBtn" style={{ display: "none" }} onClick={endCall}>
            End Call
          </button>
        </div>
      </div>
      <button id="callButton" onClick={initOpenAIRealtime}>
        Call to OpenAI Realtime
      </button>
    </div>
  );
};

export default Home;

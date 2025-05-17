import React, { useEffect, useRef, useState } from 'react';

interface VolumeIndicatorProps {
  deviceId: string;
}

export const VolumeIndicator: React.FC<VolumeIndicatorProps> = ({ deviceId }) => {
  const [volume, setVolume] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const initAudio = async () => {
      try {
        // 清理旧的音频上下文
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        
        // 创建新的音频上下文
        audioContextRef.current = new AudioContext();
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: deviceId ? { exact: deviceId } : undefined }
        });
        streamRef.current = stream;
        
        const analyser = audioContextRef.current.createAnalyser();
        analyserRef.current = analyser;
        analyser.fftSize = 256;
        
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyser);
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const updateVolume = () => {
          if (!analyserRef.current) return;
          
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setVolume(average);
          
          animationFrameRef.current = requestAnimationFrame(updateVolume);
        };
        
        updateVolume();
      } catch (error) {
        console.error('Error initializing audio:', error);
      }
    };

    if (deviceId) {
      initAudio();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [deviceId]);

  const volumePercentage = Math.min(100, (volume / 255) * 100);
  
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="text-xs w-12">
        {Math.round(volumePercentage)}%
      </div>
      <div className="flex-1 h-2 bg-base-300 rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-75"
          style={{ 
            width: `${volumePercentage}%`,
            transition: 'width 0.1s ease-out'
          }}
        />
      </div>
    </div>
  );
}; 
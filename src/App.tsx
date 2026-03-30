import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Brain, 
  Crosshair, 
  Database, 
  Eye, 
  Layers, 
  Zap, 
  ShieldAlert,
  ChevronRight,
  History,
  Target,
  Cpu,
  Monitor,
  Play,
  Square,
  Loader2,
  MessageSquare,
  Send,
  User,
  Bot,
  BrainCircuit,
  Settings,
  X,
  Check,
  ExternalLink
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { cn } from './lib/utils';
import { GameState, GameEntity, StrategyAnalysis, Prediction, ChatMessage, UserSettings } from './types';
import { analyzeStrategy, analyzeScreen, analyzeGameFrame, processTacticalQuery } from './services/aiService';

// --- Constants ---
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const MEMORY_SIZE = 20;

// --- Components ---

const SettingsModal = ({ 
  isOpen, 
  onClose, 
  settings, 
  onSettingsChange 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  settings: UserSettings, 
  onSettingsChange: (settings: UserSettings) => void 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/30">
          <div className="flex items-center gap-2">
            <Settings size={20} className="text-blue-500" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-white">Overlay Settings</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Entity Colors */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">Entity Colors</h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(settings.entityColors).map(([type, color]) => (
                <div key={type} className="space-y-2">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">{type}</label>
                  <div className="flex items-center gap-2">
                    <input 
                      id={`color-${type}`}
                      type="color" 
                      value={color}
                      onChange={(e) => onSettingsChange({
                        ...settings,
                        entityColors: { ...settings.entityColors, [type]: e.target.value }
                      })}
                      className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                    />
                    <span className="text-[10px] font-mono text-slate-300 uppercase">{color}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Text Size */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">Text Size</h3>
            <div className="flex gap-2">
              {(['small', 'medium', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => onSettingsChange({ ...settings, textSize: size })}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all",
                    settings.textSize === size 
                      ? "bg-blue-600 border-blue-500 text-white" 
                      : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300"
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </section>

          {/* Grid Settings */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Grid Visibility</h3>
              <button
                onClick={() => onSettingsChange({ ...settings, showGrid: !settings.showGrid })}
                className={cn(
                  "w-10 h-5 rounded-full relative transition-all",
                  settings.showGrid ? "bg-blue-600" : "bg-slate-800"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                  settings.showGrid ? "left-6" : "left-1"
                )} />
              </button>
            </div>
            
            {settings.showGrid && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Grid Opacity</label>
                  <span className="text-[10px] font-mono text-slate-300">{Math.round(settings.gridOpacity * 100)}%</span>
                </div>
                <input 
                  id="grid-opacity"
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05"
                  value={settings.gridOpacity}
                  onChange={(e) => onSettingsChange({ ...settings, gridOpacity: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            )}
          </section>
        </div>

        <div className="p-6 bg-slate-900/30 border-t border-slate-800 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
          >
            <Check size={14} />
            SAVE SETTINGS
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const GameSimulator = ({ 
  onStateUpdate, 
  prediction,
  mode,
  capturedEntities,
  settings
}: { 
  onStateUpdate: (state: GameState) => void,
  prediction: StrategyAnalysis | null,
  mode: 'sim' | 'live',
  capturedEntities: GameEntity[],
  settings: UserSettings
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [entities, setEntities] = useState<GameEntity[]>([
    {
      id: 'player',
      type: 'player',
      position: { x: 100, y: 200 },
      velocity: { x: 0, y: 0 },
      health: 100,
      state: 'idle'
    },
    {
      id: 'enemy-1',
      type: 'enemy',
      position: { x: 500, y: 200 },
      velocity: { x: -1, y: 0.5 },
      health: 100,
      state: 'patrolling'
    }
  ]);

  const updateSimulation = useCallback(() => {
    if (mode !== 'sim') return;

    setEntities(prev => {
      return prev.map(entity => {
        if (entity.type === 'enemy') {
          let vx = entity.velocity?.x || 0;
          let vy = entity.velocity?.y || 0;

          if (entity.position.x <= 50 || entity.position.x >= CANVAS_WIDTH - 50) vx *= -1;
          if (entity.position.y <= 50 || entity.position.y >= CANVAS_HEIGHT - 50) vy *= -1;

          if (Math.random() < 0.02) {
            vx = (Math.random() - 0.5) * 4;
            vy = (Math.random() - 0.5) * 4;
          }

          return {
            ...entity,
            position: {
              x: entity.position.x + vx,
              y: entity.position.y + vy
            },
            velocity: { x: vx, y: vy },
            state: Math.abs(vx) + Math.abs(vy) > 2 ? 'rushing' : 'stalking'
          };
        }
        return entity;
      });
    });

    onStateUpdate({
      timestamp: Date.now(),
      entities: entities
    });
  }, [entities, onStateUpdate, mode]);

  useEffect(() => {
    if (mode === 'sim') {
      const interval = setInterval(updateSimulation, 50);
      return () => clearInterval(interval);
    }
  }, [updateSimulation, mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Grid
    if (settings.showGrid) {
      ctx.strokeStyle = `rgba(30, 41, 59, ${settings.gridOpacity})`;
      ctx.lineWidth = 1;
      for (let x = 0; x < CANVAS_WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y < CANVAS_HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }
    }

    const displayEntities = mode === 'sim' ? entities : capturedEntities;

    displayEntities.forEach(entity => {
      const x = mode === 'sim' ? entity.position.x : (entity.position.x / 100) * CANVAS_WIDTH;
      const y = mode === 'sim' ? entity.position.y : (entity.position.y / 100) * CANVAS_HEIGHT;

      const color = settings.entityColors[entity.type] || settings.entityColors.unknown;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 20, y - 20, 40, 40);

      // Draw Strategic Path for Enemy
      if (entity.type === 'enemy' && prediction?.multiStepPlan) {
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.5)'; // Purple
        ctx.lineWidth = 1;
        
        let lastX = x;
        let lastY = y;
        
        prediction.multiStepPlan.forEach((step, i) => {
          if (step.targetPosition) {
            const tx = (step.targetPosition.x / 100) * CANVAS_WIDTH;
            const ty = (step.targetPosition.y / 100) * CANVAS_HEIGHT;
            
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(tx, ty);
            ctx.stroke();
            
            // Draw node
            ctx.fillStyle = 'rgba(168, 85, 247, 0.8)';
            ctx.beginPath();
            ctx.arc(tx, ty, 3, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw label for first node
            if (i === 0) {
              const fontSize = settings.textSize === 'small' ? 6 : settings.textSize === 'large' ? 10 : 8;
              ctx.font = `${fontSize}px Inter`;
              ctx.fillText(step.description.toUpperCase(), tx + 5, ty + 5);
            }
            
            lastX = tx;
            lastY = ty;
          }
        });
        ctx.setLineDash([]);
      }

      ctx.fillStyle = color;
      const fontSize = settings.textSize === 'small' ? 8 : settings.textSize === 'large' ? 14 : 10;
      ctx.font = `${fontSize}px Courier New`;
      ctx.fillText(`${entity.type.toUpperCase()} [${Math.round(x)},${Math.round(y)}]`, x - 20, y - 25);

      if (entity.health !== undefined) {
        ctx.fillStyle = '#334155';
        ctx.fillRect(x - 20, y + 25, 40, 4);
        ctx.fillStyle = color;
        ctx.fillRect(x - 20, y + 25, 40 * (entity.health / 100), 4);
      }

      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
    });

    if (prediction && displayEntities.length > 0) {
      const enemyEntity = displayEntities.find(e => e.type === 'enemy');
      if (enemyEntity) {
        const ex = mode === 'sim' ? enemyEntity.position.x : (enemyEntity.position.x / 100) * CANVAS_WIDTH;
        const ey = mode === 'sim' ? enemyEntity.position.y : (enemyEntity.position.y / 100) * CANVAS_HEIGHT;

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.setLineDash([5, 5]);
        ctx.arc(ex, ey, 100, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        if (prediction.predictedNextMove.toLowerCase().includes('left')) {
          drawArrow(ctx, ex, ey, ex - 50, ey);
        } else if (prediction.predictedNextMove.toLowerCase().includes('attack')) {
          const playerEntity = displayEntities.find(e => e.type === 'player');
          if (playerEntity) {
            const px = mode === 'sim' ? playerEntity.position.x : (playerEntity.position.x / 100) * CANVAS_WIDTH;
            const py = mode === 'sim' ? playerEntity.position.y : (playerEntity.position.y / 100) * CANVAS_HEIGHT;
            drawArrow(ctx, ex, ey, px, py, '#ef4444');
          }
        }
      }
    }
  }, [entities, prediction, mode, capturedEntities]);

  const drawArrow = (ctx: CanvasRenderingContext2D, fromx: number, fromy: number, tox: number, toy: number, color = '#3b82f6') => {
    const headlen = 10;
    const dx = tox - fromx;
    const dy = toy - fromy;
    const angle = Math.atan2(dy, dx);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  };

  return (
    <div className="relative border-2 border-slate-800 rounded-lg overflow-hidden bg-slate-950 shadow-2xl shadow-blue-900/20">
      <div className="absolute top-2 left-2 flex items-center gap-2 px-2 py-1 bg-slate-900/80 backdrop-blur rounded border border-slate-700 z-10">
        <div className={cn("w-2 h-2 rounded-full animate-pulse", mode === 'sim' ? "bg-blue-500" : "bg-red-500")} />
        <span className="text-[10px] font-mono text-slate-300 uppercase tracking-widest">
          {mode === 'sim' ? 'Simulation Mode' : 'Live Capture Active'}
        </span>
      </div>
      <canvas 
        ref={canvasRef} 
        width={CANVAS_WIDTH} 
        height={CANVAS_HEIGHT}
        className="w-full h-auto cursor-crosshair"
      />
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color }: { icon: any, label: string, value: string | number, color: string }) => (
  <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg flex items-center gap-3">
    <div className={cn("p-2 rounded-md", color)}>
      <Icon size={16} className="text-white" />
    </div>
    <div>
      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{label}</p>
      <p className="text-sm font-mono text-slate-200">{value}</p>
    </div>
  </div>
);

export default function App() {
  const [history, setHistory] = useState<GameState[]>([]);
  const [prediction, setPrediction] = useState<StrategyAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'vision' | 'memory' | 'prediction' | 'chat'>('vision');
  
  // User Settings State
  const [settings, setSettings] = useState<UserSettings>({
    entityColors: {
      player: '#10b981',
      enemy: '#ef4444',
      projectile: '#3b82f6',
      unknown: '#94a3b8'
    },
    textSize: 'medium',
    showGrid: true,
    gridOpacity: 0.1
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Tactical Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');

  // Live Capture State
  const [mode, setMode] = useState<'sim' | 'live'>('sim');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedEntities, setCapturedEntities] = useState<GameEntity[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [captureInterval, setCaptureInterval] = useState<number>(15000); // Default 15s (4 RPM)
  const [isManualMode, setIsManualMode] = useState(false);
  const [analysisCount, setAnalysisCount] = useState(0);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);

  const handleStateUpdate = useCallback((state: GameState) => {
    setHistory(prev => {
      const newHistory = [...prev, state];
      if (newHistory.length > MEMORY_SIZE) return newHistory.slice(-MEMORY_SIZE);
      return newHistory;
    });
  }, []);

  const startCapture = async () => {
    setError(null);
    
    // Check if we are in an iframe
    const isInIframe = window.self !== window.top;
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setError("Screen capture is not supported in this browser or environment.");
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      setStream(mediaStream);
      setMode('live');
      setIsCapturing(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      mediaStream.getVideoTracks()[0].onended = () => {
        stopCapture();
      };
    } catch (err: any) {
      console.error("Error starting capture:", err);
      
      let errorMessage = "Failed to start screen capture.";
      
      if (err.name === 'NotAllowedError' || err.message?.includes('denied')) {
        errorMessage = "Permission to capture screen was denied. Browser security often blocks screen capture inside iframes.";
      } else if (err.name === 'SecurityError') {
        errorMessage = "A security error occurred. Browsers block screen capture in restricted iframes for your safety.";
      } else {
        errorMessage = `Error: ${err.message || "Unknown error"}`;
      }

      if (isInIframe) {
        errorMessage += " To fix this, you MUST open the application in a new tab.";
      }

      setError(errorMessage);
      setMode('sim');
      setIsCapturing(false);
    }
  };

  const stopCapture = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setMode('sim');
    setIsCapturing(false);
    setCapturedEntities([]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
      timestamp: Date.now()
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await processTacticalQuery(
        chatInput,
        history,
        mode === 'sim' ? history[history.length - 1]?.entities || [] : capturedEntities,
        chatMessages
      );

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      };

      setChatMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error("Chat error:", err);
    } finally {
      setIsChatLoading(false);
    }
  };

  const validateGameState = (state: GameState, lastState?: GameState): boolean => {
    if (!state.entities || state.entities.length === 0) return false;

    // Basic range and type validation
    const isValid = state.entities.every(entity => {
      const pos = entity.position;
      return (
        pos.x >= 0 && pos.x <= 100 &&
        pos.y >= 0 && pos.y <= 100 &&
        ['player', 'enemy', 'projectile', 'unknown'].includes(entity.type)
      );
    });

    if (!isValid) return false;

    // Temporal consistency: check for impossible jumps
    if (lastState) {
      const MAX_JUMP = 50; // Max 50% screen jump in 4 seconds
      const hasImpossibleJump = state.entities.some(entity => {
        const prevEntity = lastState.entities.find(e => e.id === entity.id || e.type === entity.type);
        if (!prevEntity) return false;
        
        const dx = Math.abs(entity.position.x - prevEntity.position.x);
        const dy = Math.abs(entity.position.y - prevEntity.position.y);
        return dx > MAX_JUMP || dy > MAX_JUMP;
      });

      if (hasImpossibleJump) return false;
    }

    return true;
  };

  // Live Analysis Loop
  useEffect(() => {
    if (!isCapturing || mode !== 'live') return;

    const captureAndAnalyze = async () => {
      if (!videoRef.current || !captureCanvasRef.current || isRateLimited) return;
      if (isManualMode && isAnalyzing) return;

      const canvas = captureCanvasRef.current;
      const video = videoRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw current video frame to canvas
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to base64
      const base64Image = canvas.toDataURL('image/jpeg', 0.7);

      // Analyze with Gemini
      setIsAnalyzing(true);
      const startTime = Date.now();
      
      try {
        const { entities, strategy } = await analyzeGameFrame(base64Image, history);
        const endTime = Date.now();
        setLatency(endTime - startTime);
        
        // Reset rate limit state on success
        setIsRateLimited(false);

        // Update history for strategy analysis
        const newState: GameState = {
          timestamp: Date.now(),
          entities: entities
        };

        // Validate before updating state and history
        if (validateGameState(newState, history[history.length - 1])) {
          setCapturedEntities(entities);
          handleStateUpdate(newState);

          if (strategy) {
            setPrediction(strategy);
          }
        } else {
          console.warn("Discarded inconsistent game state:", newState);
        }
      } catch (err: any) {
        if (err?.message?.includes("429") || JSON.stringify(err).includes("429")) {
          setIsRateLimited(true);
          setError("Rate limit exceeded. Cooling down...");
          // Auto-reset rate limit after 60 seconds
          setTimeout(() => {
            setIsRateLimited(false);
            setError(null);
          }, 60000);
        } else {
          setError(err?.message || "An error occurred during analysis.");
        }
      } finally {
        setIsAnalyzing(false);
      }
    };

    const interval = setInterval(() => {
      if (!isManualMode) {
        captureAndAnalyze();
      }
    }, captureInterval);

    const handleManualTrigger = () => {
      if (isManualMode) {
        captureAndAnalyze();
      }
    };

    window.addEventListener('manual-analysis', handleManualTrigger);
    return () => {
      clearInterval(interval);
      window.removeEventListener('manual-analysis', handleManualTrigger);
    };
  }, [isCapturing, mode, history, handleStateUpdate, captureInterval, isManualMode, isRateLimited]);

  const latestState = history[history.length - 1];
  const enemy = (mode === 'sim' ? latestState?.entities : capturedEntities)?.find(e => e.type === 'enemy');

  return (
    <div className="min-h-screen bg-[#050505] text-slate-300 font-sans selection:bg-blue-500/30">
      {/* Hidden elements for capture */}
      <video ref={videoRef} autoPlay className="hidden" />
      <canvas ref={captureCanvasRef} className="hidden" />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
        {isRateLimited && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 py-2 px-6 flex items-center justify-center gap-3">
            <ShieldAlert size={16} className="text-amber-500" />
            <p className="text-xs font-mono text-amber-500 uppercase tracking-widest">
              API Rate Limit Exceeded. Cooling down for 30s to preserve quota.
            </p>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Eye className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">AEGIS <span className="text-blue-500 font-mono text-xs ml-1">v3.0.0</span></h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">Universal Game AI Observer</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Mode:</span>
              <select 
                value={isManualMode ? 'manual' : 'auto'} 
                onChange={(e) => setIsManualMode(e.target.value === 'manual')}
                className="bg-transparent text-[10px] font-mono text-blue-400 focus:outline-none cursor-pointer"
              >
                <option value="auto">AUTO</option>
                <option value="manual">MANUAL</option>
              </select>
            </div>

            {!isManualMode && (
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Freq:</span>
                <select 
                  value={captureInterval} 
                  onChange={(e) => setCaptureInterval(Number(e.target.value))}
                  className="bg-transparent text-[10px] font-mono text-blue-400 focus:outline-none cursor-pointer"
                >
                  <option value={5000}>5s</option>
                  <option value={10000}>10s</option>
                  <option value={15000}>15s</option>
                  <option value={30000}>30s</option>
                  <option value={60000}>60s</option>
                </select>
              </div>
            )}

            {isManualMode && isCapturing && (
              <button 
                onClick={() => {
                  // Trigger manual analysis
                  const event = new CustomEvent('manual-analysis');
                  window.dispatchEvent(event);
                }}
                disabled={isAnalyzing || isRateLimited}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
              >
                <Zap size={12} />
                REFRESH NOW
              </button>
            )}
            {mode === 'sim' ? (
              <button 
                onClick={startCapture}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-blue-600/20"
              >
                <Monitor size={16} />
                ANALYZE ONSCREEN GAME
              </button>
            ) : (
              <button 
                onClick={stopCapture}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-red-600/20"
              >
                <Square size={16} />
                STOP CAPTURE
              </button>
            )}
            <div className="h-4 w-[1px] bg-slate-800" />
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
              title="Overlay Settings"
            >
              <Settings size={18} />
            </button>
            <div className="h-4 w-[1px] bg-slate-800" />
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", isCapturing ? "bg-red-500 animate-pulse" : "bg-emerald-500")} />
              <span className="text-xs font-mono text-slate-400 uppercase">{isCapturing ? 'LIVE' : 'READY'}</span>
            </div>
            <div className="h-4 w-[1px] bg-slate-800" />
            <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-lg border border-slate-800">
              {[
                { label: '0.25 FPS', value: 4000 },
                { label: '1 FPS', value: 1000 },
                { label: '5 FPS', value: 200 },
                { label: 'REAL-TIME', value: 100 }
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setCaptureInterval(opt.value)}
                  className={cn(
                    "px-2 py-1 text-[8px] font-bold uppercase tracking-wider rounded transition-all",
                    captureInterval === opt.value 
                      ? "bg-blue-600 text-white" 
                      : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Game Feed & Vision */}
        <div className="lg:col-span-8 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Crosshair size={20} className="text-blue-500" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-white">Visual Processing Unit</h2>
              </div>
              <div className="flex gap-1">
                {['vision', 'memory', 'prediction'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={cn(
                      "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all",
                      activeTab === tab 
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                        : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <GameSimulator 
              onStateUpdate={handleStateUpdate} 
              prediction={prediction} 
              mode={mode}
              capturedEntities={capturedEntities}
              settings={settings}
            />

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-3 text-red-400 text-xs"
                >
                  <ShieldAlert size={16} />
                  <p className="flex-1">{error}</p>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        const newWindow = window.open(window.location.href, '_blank');
                        if (!newWindow) {
                          setError("Popup blocked! Please allow popups to open the app in a new tab.");
                        }
                      }}
                      className="text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-md font-bold text-[10px] transition-all flex items-center gap-1 shadow-lg shadow-blue-600/20"
                    >
                      <ExternalLink size={12} />
                      OPEN IN NEW TAB
                    </button>
                    <button onClick={() => setError(null)} className="text-slate-400 hover:text-white transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              <SettingsModal 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
                settings={settings} 
                onSettingsChange={setSettings} 
              />
            </AnimatePresence>
          </section>

          {/* Real-time Data Extraction */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard 
              icon={Target} 
              label="Enemy Pos" 
              value={enemy ? `${Math.round(mode === 'sim' ? enemy.position.x : enemy.position.x)}, ${Math.round(mode === 'sim' ? enemy.position.y : enemy.position.y)}` : 'N/A'} 
              color="bg-red-500/20" 
            />
            <StatCard 
              icon={Zap} 
              label="Velocity" 
              value={enemy?.velocity ? `${enemy.velocity.x.toFixed(1)}, ${enemy.velocity.y.toFixed(1)}` : 'N/A'} 
              color="bg-amber-500/20" 
            />
            <StatCard 
              icon={Activity} 
              label="State" 
              value={enemy?.state || 'IDLE'} 
              color="bg-blue-500/20" 
            />
            <StatCard 
              icon={History} 
              label="Memory" 
              value={`${history.length} / ${MEMORY_SIZE}`} 
              color="bg-purple-500/20" 
            />
          </section>

          {/* Sequence Memory Visualization */}
          <section className="bg-slate-950 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <History size={18} className="text-purple-500" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-white">Temporal Sequence Buffer</h3>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
              {history.map((state, i) => (
                <div key={i} className="flex-shrink-0 w-24 space-y-2">
                  <div className="h-16 bg-slate-900 rounded border border-slate-800 flex items-center justify-center relative group overflow-hidden">
                    <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="text-[10px] font-mono text-slate-600">t-{history.length - 1 - i}</span>
                  </div>
                  <div className="text-[8px] font-mono text-slate-500 text-center truncate">
                    {state.entities.find(e => e.type === 'enemy')?.state || 'IDLE'}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: AI Insights */}
        <div className="lg:col-span-4 space-y-6">
          <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'prediction', label: 'Strategy', icon: Brain },
              { id: 'chat', label: 'Tactical Chat', icon: MessageSquare }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all",
                  activeTab === tab.id 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
                )}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'prediction' ? (
            <section className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-slate-800 bg-slate-900/30">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Brain size={20} className="text-blue-500" />
                  <h2 className="text-sm font-bold uppercase tracking-widest text-white">Strategy Engine</h2>
                </div>
                {isAnalyzing ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={14} className="text-blue-500 animate-spin" />
                    <span className="text-[10px] font-mono text-blue-500 uppercase tracking-widest">ANALYZING...</span>
                  </div>
                ) : latency && (
                  <div className="flex items-center gap-2">
                    <Zap size={12} className="text-emerald-500" />
                    <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest">LATENCY: {latency}ms</span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="bg-slate-900/80 border border-slate-700 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <BrainCircuit size={14} className="text-purple-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ML Playstyle Classification</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white font-medium">
                      {prediction?.currentStrategy.toLowerCase().includes('aggressive') || prediction?.currentStrategy.toLowerCase().includes('rush') ? 'RUSHER' : 
                       prediction?.currentStrategy.toLowerCase().includes('flank') ? 'FLANKER' : 
                       prediction?.currentStrategy.toLowerCase().includes('defensive') || prediction?.currentStrategy.toLowerCase().includes('stalking') ? 'ZONER' : 'NEUTRAL'}
                    </p>
                    <span className="text-[8px] font-mono text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                      PATTERN RECOGNIZED
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-700 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert size={14} className={cn(
                      prediction?.threatLevel === 'high' ? "text-red-500" : "text-amber-500"
                    )} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Strategy</span>
                  </div>
                  <p className="text-sm text-white font-medium italic">
                    {prediction?.currentStrategy || "Awaiting sufficient data sequence..."}
                  </p>
                </div>

                <div className="bg-blue-600/10 border border-blue-500/30 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <ChevronRight size={14} className="text-blue-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Predicted Next Move</span>
                  </div>
                  <p className="text-lg text-white font-bold tracking-tight">
                    {prediction?.predictedNextMove || "---"}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(prediction?.confidence || 0) * 100}%` }}
                        className="h-full bg-blue-500"
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">{Math.round((prediction?.confidence || 0) * 100)}% CONF</span>
                  </div>
                </div>

                {prediction?.multiStepPlan && prediction.multiStepPlan.length > 0 && (
                  <div className="bg-purple-600/10 border border-purple-500/30 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Layers size={14} className="text-purple-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Multi-Step Forecast</span>
                    </div>
                    <div className="space-y-2">
                      {prediction.multiStepPlan.map((step, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded-full bg-purple-500/20 border border-purple-500/50 flex items-center justify-center text-[8px] font-bold text-purple-400">
                            {i + 1}
                          </div>
                          <p className="text-xs text-slate-300 font-medium">{step.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 flex-1">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">Action Probability Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={prediction?.predictions || []} layout="vertical" margin={{ left: -20, right: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="action" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                    />
                    <Tooltip 
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                    />
                    <Bar dataKey="probability" radius={[0, 4, 4, 0]} barSize={20}>
                      {(prediction?.predictions || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#1e293b'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-500">LATENCY</span>
                  <span className="text-emerald-500">12ms</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-500">MODEL</span>
                  <span className="text-slate-300">GEMINI-3-FLASH</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-500">PIPELINE</span>
                  <span className="text-slate-300">ASYNC_STREAM</span>
                </div>
              </div>
            </div>
          </section>
          ) : (
            <section className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[600px]">
              <div className="p-6 border-b border-slate-800 bg-slate-900/30">
                <div className="flex items-center gap-2">
                  <MessageSquare size={20} className="text-blue-500" />
                  <h2 className="text-sm font-bold uppercase tracking-widest text-white">Tactical Assistant</h2>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Natural Language Tactical Query Interface</p>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                    <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center">
                      <Bot size={24} className="text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white uppercase tracking-widest">Awaiting Query</p>
                      <p className="text-[10px] text-slate-500 mt-1">Ask about the enemy's position, strategy, or best counter-moves.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 w-full max-w-[200px]">
                      {[
                        "What is the enemy's current playstyle?",
                        "Predict their next rotation.",
                        "Are they preparing an ambush?"
                      ].map((q, i) => (
                        <button 
                          key={i}
                          onClick={() => setChatInput(q)}
                          className="text-[9px] text-slate-400 bg-slate-900 hover:bg-slate-800 border border-slate-800 p-2 rounded transition-colors text-left"
                        >
                          "{q}"
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className={cn(
                      "flex gap-3",
                      msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                    )}>
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        msg.role === 'user' ? "bg-blue-600" : "bg-slate-800 border border-slate-700"
                      )}>
                        {msg.role === 'user' ? <User size={16} className="text-white" /> : <Bot size={16} className="text-blue-500" />}
                      </div>
                      <div className={cn(
                        "max-w-[80%] p-3 rounded-xl text-xs leading-relaxed",
                        msg.role === 'user' 
                          ? "bg-blue-600 text-white rounded-tr-none" 
                          : "bg-slate-900 text-slate-300 border border-slate-800 rounded-tl-none"
                      )}>
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
                {isChatLoading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                      <Loader2 size={16} className="text-blue-500 animate-spin" />
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl rounded-tl-none">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleSendMessage} className="p-4 bg-slate-900/50 border-t border-slate-800">
                <div className="relative">
                  <input 
                    id="chat-input"
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask tactical assistant..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-4 pr-12 py-3 text-xs text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                  <button 
                    type="submit"
                    disabled={!chatInput.trim() || isChatLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded flex items-center justify-center transition-all"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      </main>

      {/* Footer / Status Bar */}
      <footer className="border-t border-slate-800 bg-slate-950 px-6 py-3 flex items-center justify-between text-[10px] font-mono text-slate-500">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Cpu size={12} />
            <span>GPU_LOAD: 14%</span>
          </div>
          <div className="flex items-center gap-1">
            <Database size={12} />
            <span>BUFFER_USAGE: 42%</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {latency && (
            <div className="flex items-center gap-1 text-emerald-500">
              <Zap size={12} />
              <span>AI_LATENCY: {latency}ms</span>
            </div>
          )}
          <span>SYSTEM_TIME: {new Date().toLocaleTimeString()}</span>
          <span className="text-blue-500">AEGIS_CORE_CONNECTED</span>
        </div>
      </footer>
    </div>
  );
}

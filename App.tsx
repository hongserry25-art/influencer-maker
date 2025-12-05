import React, { useState, useEffect } from 'react';
import { Sparkles, Info, AlertTriangle, Loader2, Camera, Clapperboard, UserPlus, Key } from 'lucide-react';
import PhotoUploader from './components/PhotoUploader';
import Controls from './components/Controls';
import CameraControls from './components/CameraControls';
import ResultGallery from './components/ResultGallery';
import PersonaCard from './components/PersonaCard';
import PersonaCreator from './components/PersonaCreator';
import { Persona, StoryBatch, AppState, CameraSettings, CreatorAttributes } from './types';
import { analyzePersona, planStory, generateStoryBatch, generateStudioImage, generateReferenceImage } from './services/geminiService';

type Tab = 'story' | 'studio' | 'maker';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('story');
  const [refImage, setRefImage] = useState<string | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  
  // Story Mode State
  const [stories, setStories] = useState<StoryBatch[]>([]);
  const [scenarioInput, setScenarioInput] = useState("");
  
  // Studio Mode State
  const [cameraSettings, setCameraSettings] = useState<CameraSettings>({
    rotation: 0,
    zoom: 0,
    vertical: 0,
    isWideAngle: false
  });
  
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyError, setApiKeyError] = useState(false);
  
  // API Key Management
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState("");

  const checkApiKey = () => {
    const hasEnvKey = !!process.env.API_KEY;
    const hasLocalKey = !!localStorage.getItem('gemini_api_key');
    if (!hasEnvKey && !hasLocalKey) {
      setApiKeyError(true);
    } else {
      setApiKeyError(false);
    }
  };

  useEffect(() => {
    checkApiKey();
  }, []);

  const handleSaveApiKey = () => {
    if (tempApiKey.trim()) {
      localStorage.setItem('gemini_api_key', tempApiKey.trim());
      setTempApiKey("");
      setShowApiKeyModal(false);
      checkApiKey();
    }
  };

  // When image uploads, analyze persona immediately
  const handleImageSelect = async (base64: string) => {
    setRefImage(base64);
    setPersona(null); 
    setAppState(AppState.ANALYZING);
    setError(null);
    // If in maker mode, switch to story mode to show results
    if (activeTab === 'maker') setActiveTab('story');

    try {
      const generatedPersona = await analyzePersona(base64);
      setPersona(generatedPersona);
      setAppState(AppState.IDLE);
    } catch (err: any) {
      console.error(err);
      setError("Could not analyze persona. Please try a clearer photo or check your API key.");
      setAppState(AppState.ERROR);
    }
  };

  const handleCreatePersona = async (attrs: CreatorAttributes) => {
    setAppState(AppState.ANALYZING); // Reusing ANALYZING state for creation
    setError(null);
    setRefImage(null);
    setPersona(null);

    try {
      // 1. Generate the base image
      const generatedImage = await generateReferenceImage(attrs);
      setRefImage(generatedImage);

      // 2. Analyze the generated image to create the profile text
      const generatedPersona = await analyzePersona(generatedImage);
      setPersona(generatedPersona);
      
      setAppState(AppState.IDLE);
      setActiveTab('story'); // Switch to story mode to start using the new model
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create persona.");
      setAppState(AppState.ERROR);
    }
  };

  const handleGenerateStory = async (isAuto: boolean) => {
    if (!refImage || !persona) return;
    
    setAppState(AppState.PLANNING);
    setError(null);

    try {
      const currentScenario = isAuto ? "" : scenarioInput;
      const prompts = await planStory(persona, currentScenario);
      
      setAppState(AppState.GENERATING);
      const generatedImages = await generateStoryBatch(refImage, prompts);
      
      if (generatedImages.length === 0) throw new Error("Failed to generate any images.");

      const newStory: StoryBatch = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        scenario: currentScenario || "AI Lifestyle Series",
        images: generatedImages.map((img, idx) => ({
          id: `${Date.now()}-${idx}`,
          url: img.url,
          prompt: img.prompt
        }))
      };

      setStories(prev => [newStory, ...prev]);
      setAppState(AppState.SUCCESS);
      setTimeout(() => setAppState(AppState.IDLE), 1000);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to generate story.");
      setAppState(AppState.ERROR);
    }
  };

  const handleGenerateStudio = async () => {
    if (!refImage || !persona) return;
    setAppState(AppState.GENERATING);
    setError(null);

    try {
      const result = await generateStudioImage(refImage, cameraSettings, persona);
      
      const newBatch: StoryBatch = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        scenario: "Studio Session",
        images: [{
          id: Date.now().toString(),
          url: result.url,
          prompt: result.prompt
        }]
      };

      setStories(prev => [newBatch, ...prev]);
      setAppState(AppState.SUCCESS);
      setTimeout(() => setAppState(AppState.IDLE), 1000);
    } catch (err: any) {
      setError(err.message || "Failed to generate studio shot.");
      setAppState(AppState.ERROR);
    }
  };

  const resetAll = () => {
    setRefImage(null);
    setPersona(null);
    setStories([]);
    setScenarioInput("");
    setAppState(AppState.IDLE);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-purple-500/30">
      {/* Navbar - Updated Color to #9B69FF */}
      <nav className="bg-[#9B69FF] sticky top-0 z-50 shadow-lg transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm shadow-sm">
              <Sparkles size={20} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Influencer<span className="text-white/90">AI</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1 bg-black/20 p-1 rounded-full border border-white/10 backdrop-blur-sm mr-2">
              <button 
                onClick={() => setActiveTab('story')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'story' ? 'bg-white text-[#9B69FF] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
              >
                <Clapperboard size={14} /> Story Mode
              </button>
              <button 
                onClick={() => setActiveTab('studio')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'studio' ? 'bg-white text-[#9B69FF] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
              >
                <Camera size={14} /> Studio Mode
              </button>
              <button 
                onClick={() => setActiveTab('maker')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'maker' ? 'bg-white text-[#9B69FF] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
              >
                <UserPlus size={14} /> Maker
              </button>
            </div>
            
            <button 
               onClick={() => setShowApiKeyModal(true)}
               className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
               title="Set API Key"
            >
               <Key size={18} />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        
        {apiKeyError && (
           <div className="mb-8 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-red-200">
             <div className="flex items-center gap-3">
               <AlertTriangle className="shrink-0" />
               <div>
                 <p className="font-bold">Missing API Key</p>
                 <p className="text-sm opacity-80">Please provide a valid Gemini API Key to use this application.</p>
               </div>
             </div>
             <button 
                onClick={() => setShowApiKeyModal(true)}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-100 px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
             >
                Register API Key
             </button>
           </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Left Column: Input & Controls */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Conditional Rendering based on Tab */}
            {activeTab === 'maker' ? (
              <section className="animate-in fade-in slide-in-from-left-4 duration-500">
                 <PersonaCreator 
                    onCreate={handleCreatePersona} 
                    isGenerating={appState === AppState.ANALYZING} 
                 />
              </section>
            ) : (
              // Story or Studio Mode - Existing Flow
              <>
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">1. Identity Source</h2>
                  </div>
                  
                  <PhotoUploader 
                    selectedImage={refImage} 
                    onImageSelect={handleImageSelect}
                    onClear={resetAll} 
                  />
                  
                  {appState === AppState.ANALYZING && (
                    <div className="mt-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center gap-3 text-purple-400 animate-pulse">
                      <Loader2 className="animate-spin" />
                      <span className="text-sm font-medium">Analyzing visual identity...</span>
                    </div>
                  )}
                </section>

                {/* Persona Display */}
                {persona && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <PersonaCard persona={persona} onReset={resetAll} />
                  </div>
                )}

                {/* Controls Area - Switches based on Tab */}
                <div className={!persona ? 'opacity-50 pointer-events-none filter grayscale transition-all' : 'transition-all'}>
                  
                  {activeTab === 'story' ? (
                    <Controls 
                        persona={persona}
                        scenarioInput={scenarioInput}
                        setScenarioInput={setScenarioInput}
                        onGenerate={handleGenerateStory}
                        appState={appState}
                        disabled={!persona || apiKeyError}
                    />
                  ) : (
                    <CameraControls 
                        settings={cameraSettings}
                        setSettings={setCameraSettings}
                        onGenerate={handleGenerateStudio}
                        isGenerating={appState === AppState.GENERATING}
                        onReset={() => setCameraSettings({ rotation: 0, zoom: 0, vertical: 0, isWideAngle: false })}
                        disabled={!persona || apiKeyError}
                    />
                  )}
                </div>
              </>
            )}

            {error && (
               <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg flex items-start gap-2">
                 <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                 {error}
               </div>
            )}
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-8">
             <div className="h-full">
                {stories.length > 0 ? (
                  <ResultGallery stories={stories} />
                ) : (
                  <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-zinc-600 border-2 border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20">
                    <div className="relative mb-6">
                      <div className={`absolute inset-0 blur-xl rounded-full ${activeTab === 'story' ? 'bg-purple-500/20' : activeTab === 'studio' ? 'bg-orange-500/20' : 'bg-blue-500/20'}`}></div>
                      {activeTab === 'story' && <Clapperboard size={64} className="relative text-zinc-700" />}
                      {activeTab === 'studio' && <Camera size={64} className="relative text-zinc-700" />}
                      {activeTab === 'maker' && <UserPlus size={64} className="relative text-zinc-700" />}
                    </div>
                    <h3 className="text-xl font-bold text-zinc-500 mb-2">
                       {activeTab === 'story' && "Ready to create stories"}
                       {activeTab === 'studio' && "Studio is empty"}
                       {activeTab === 'maker' && "Design your Model"}
                    </h3>
                    <p className="max-w-xs text-center text-sm mb-6">
                      {activeTab === 'story' && "Generate 8-frame lifestyle stories based on the persona."}
                      {activeTab === 'studio' && "Adjust camera settings to take professional studio shots."}
                      {activeTab === 'maker' && "Use the form on the left to generate a unique AI Influencer identity."}
                    </p>
                  </div>
                )}
             </div>
          </div>
        </div>

        {/* API Key Modal */}
        {showApiKeyModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-md shadow-2xl scale-100">
               <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                 <Key className="text-purple-500" /> Set API Key
               </h3>
               <p className="text-zinc-400 text-sm mb-4 leading-relaxed">
                 To use this app, you need a valid Gemini API key. 
                 The key is stored securely in your browser's local storage.
               </p>
               
               <div className="space-y-4">
                 <input 
                   type="password" 
                   placeholder="Enter your Gemini API Key (AI...)" 
                   value={tempApiKey}
                   onChange={e => setTempApiKey(e.target.value)}
                   className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                 />
                 
                 <div className="flex justify-end gap-3 pt-2">
                   <button 
                     onClick={() => setShowApiKeyModal(false)} 
                     className="px-4 py-2 text-zinc-400 hover:text-white text-sm font-medium transition-colors"
                   >
                     Cancel
                   </button>
                   <button 
                     onClick={handleSaveApiKey} 
                     disabled={!tempApiKey.trim()}
                     className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-lg text-sm font-bold transition-all"
                   >
                     Save Key
                   </button>
                 </div>
               </div>
               
               <p className="mt-4 text-xs text-zinc-600 text-center">
                  Don't have a key? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-purple-400 hover:underline">Get one here</a>
               </p>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;
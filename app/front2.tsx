

import React, { useState, useCallback, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Play, Edit3, Settings, Video, Sparkles, ArrowRight, LayoutGrid } from 'lucide-react';
import { callLlm, callStructuredLlm } from './llm';
import { promptFormation } from './prompts';
import { LLM_API_KEY } from './constant';
import data from '../dynamication.json'

interface FormData {
  prompt: string;
  modelName: string;
  contentClass: string;
  script: string;
  preferences: {
    subtitles: boolean;
    style: string;
    avatar: string;
  };
}

// Step Indicator Component
const StepIndicator = ({ currentStep, steps }: { currentStep: number; steps: any[] }) => (
  <div className="flex items-center justify-center mb-8">
    {steps.map((step, index) => (
      <div key={step.id} className="flex items-center">
        <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${index <= currentStep
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'border-gray-300 text-gray-400'
          }`}>
          <step.icon className="w-5 h-5" />
        </div>
        <div className="ml-2 mr-4">
          <div className={`text-sm font-medium ${index <= currentStep ? 'text-blue-600' : 'text-gray-400'
            }`}>
            {step.title}
          </div>
        </div>
        {index < steps.length - 1 && (
          <ChevronRight className={`w-4 h-4 mx-2 ${index < currentStep ? 'text-blue-600' : 'text-gray-300'
            }`} />
        )}
      </div>
    ))}
  </div>
);

// Prompt Input Step Component
const PromptInputStep = ({
  formData,
  setFormData,
  onSubmit, // for "Generate Script"
  onDirectScriptClick, // for "Direct Script"
  isLoading
}: {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  onSubmit: () => void; // Generate script click handler
  onDirectScriptClick: () => void; // Direct script click handler
  isLoading: boolean;
}) => {
  const handleDirectScript = () => {
    // Clear the prompt and any other relevant form data
    setFormData(prev => ({
      ...prev,
      prompt: '', // Clear prompt
      contentClass: 'low', // Reset content class or leave unchanged
    }));
    onDirectScriptClick(); // Optionally, call the function for next step or action
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">What's your vision?</h2>
        <p className="text-gray-600">Describe the video you want to create</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Model Name (Optional)
        </label>
        <input
          type="text"
          value={formData.modelName}
          onChange={(e) => {
            setFormData(prev => ({ ...prev, modelName: e.target.value }));
          }}
          placeholder="e.g. gemini-2.0-flash-lite"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Content Class
        </label>
        <select
          value={formData.contentClass}
          onChange={(e) => {
            const newValue = e.target.value;
            setFormData(prev => ({ ...prev, contentClass: newValue }));
          }}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="low">Low</option>
          <option value="high">High</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Video Prompt
        </label>
        <textarea
          value={formData.prompt}
          onChange={(e) => {
            const newValue = e.target.value;
            setFormData(prev => ({ ...prev, prompt: newValue }));
          }}
          placeholder="Describe your video idea in detail... (e.g., 'A peaceful morning scene with coffee and sunrise')"
          rows={6}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          style={{ fontSize: '16px' }} // Prevents zoom on mobile
        />
      </div>

      {/* Flex container for both buttons */}
      <div className="flex space-x-4">
        {/* Generate Script Button */}
        <button
          type="button"
          onClick={onSubmit} // Generate script handler
          disabled={isLoading || !formData.prompt.trim()}
          className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
              <span>Generating Script...</span>
            </>
          ) : (
            <>
              <span>Generate Script</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        {/* Direct Script Button */}
        <button
          type="button"
          onClick={handleDirectScript} // Direct Script handler
          className="w-full sm:w-auto bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
        >
          <span>Direct Script</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      <div className="flex justify-center mt-6 border-t pt-6">
        <button
          type="button"
          onClick={() => window.location.href = '/gallery'}
          className="text-gray-600 hover:text-blue-600 font-medium transition-colors flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-blue-50"
        >
          <LayoutGrid className="w-5 h-5" />
          <span>View Video Gallery</span>
        </button>
      </div>
    </div>
  );
};

// Script Verification Step Component
const ScriptVerificationStep = ({
  formData,
  setFormData,
  onBack,
  onNext
}: {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  onBack: () => void;
  onNext: () => void;
}) => (
  <div className="max-w-4xl mx-auto">
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Review & Edit Script</h2>
      <p className="text-gray-600">Make any adjustments to perfect your video script</p>
    </div>

    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Generated Script
        </label>
        <textarea
          value={formData.script}
          onChange={(e) => {
            const newValue = e.target.value;
            setFormData(prev => ({ ...prev, script: newValue }));
          }}
          rows={12}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
          style={{ fontSize: '14px' }}
        />
      </div>

      <div className="flex space-x-4">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Back to Prompt</span>
        </button>
        <button
          onClick={onNext}
          className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
        >
          <span>Finalize Script</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  </div>
);

// Avatar Selection Component

// const avatarAudioMap: Record<string, string> = {
//   female: 'https://cloud.google.com/static/text-to-speech/docs/audio/en_us_studio_o_gatsby.wav',
//   male: 'https://cloud.google.com/static/text-to-speech/docs/audio/en-IN-Chirp3-HD-Algenib.wav',
//   maleIn: 'https://cloud.google.com/static/text-to-speech/docs/audio/hi-IN-Chirp3-HD-Zubenelgenubi.wav',
//   f1_enIn:'https://cloud.google.com/static/text-to-speech/docs/audio/en-IN-Chirp3-HD-Achernar.wav',
//   f2_enIn:'https://cloud.google.com/static/text-to-speech/docs/audio/en-IN-Chirp3-HD-Despina.wav',
//   f3_hiIn:'https://cloud.google.com/static/text-to-speech/docs/audio/hi-IN-Chirp3-HD-Achernar.wav',
//   f4_hiIn:'https://cloud.google.com/static/text-to-speech/docs/audio/hi-IN-Chirp3-HD-Despina.wav'
// };
const avatarAudioMap: Record<string, string> = data.avatarAudioMap;

const AvatarSelection = ({
  selectedAvatar,
  onAvatarChange,
  playingAudio,
  onPlayAudio,
  scriptLanguage
}: {
  selectedAvatar: string;
  onAvatarChange: (avatar: string) => void;
  playingAudio: string | null;
  onPlayAudio: (avatar: string) => void;
  scriptLanguage: string
}) => {
  // const avatars = [
  //   // { value: 'female', label: 'Female Avatar', emoji: '👩' },
  //   // { value: 'male', label: 'Male Avatar', emoji: '👨' },
  //   // { value: 'maleIn', label: 'Hindi Indian Male', emoji: '👨🏽' },
  //   { value: 'f1_enIn', label: 'Female Avatar (English - India, Achernar)', emoji: '👩🏽‍🦱' },
  //   { value: 'f2_enIn', label: 'Female Avatar (English - India, Despina)', emoji: '👩🏽' },
  // ];
  // if(scriptLanguage=="hinglish"){
  //   avatars.push(    { value: 'f3_hiIn', label: 'Female Avatar (Hindi - India, Achernar)', emoji: '👩🏽‍🦱' },
  //   { value: 'f4_hiIn', label: 'Female Avatar (Hindi - India, Despina)', emoji: '👩🏽' })
  // }

  console.log("sl ", scriptLanguage)
  const avatars: { value: string, label: string, emoji: string }[] = []; // Empty array to store avatars

  // Push avatars based on `scriptLanguage`
  for (let ava of data.avatars) {
    if (scriptLanguage.toLowerCase() === "english" && ava.langType.toLowerCase() === "english") {
      avatars.push(ava);
    } else if ((scriptLanguage.toLowerCase() === "hinglish" || scriptLanguage.toLowerCase() === "hindi") &&
      (ava.langType.toLowerCase() === "hinglish" || ava.langType.toLowerCase() === "hindi")) {
      avatars.push(ava);
    }
  }




  return (
    <div className="bg-gray-50 p-6 rounded-lg">
      <h3 className="font-medium text-gray-900 mb-4">Select Avatar</h3>
      <div className="grid grid-cols-2 gap-4">
        {avatars.map((avatar) => (
          <div key={avatar.value} className="space-y-2">
            <button
              type="button"
              onClick={() => onAvatarChange(avatar.value)}
              className={`w-full p-4 rounded-lg border-2 transition-colors flex flex-col items-center space-y-2 ${selectedAvatar === avatar.value
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
                }`}
            >
              <span className="text-2xl">{avatar.emoji}</span>
              <span className="text-sm font-medium">{avatar.label}</span>
            </button>
            <button
              type="button"
              onClick={() => onPlayAudio(avatar.value)}
              className={`w-full px-3 py-2 text-xs rounded-md transition-colors flex items-center justify-center space-x-1 ${playingAudio === avatar.value
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {playingAudio === avatar.value ? (
                <>
                  <div className="w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Playing...</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  <span>Preview Voice</span>
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
const AudiosComponent = ({
  selectedAvatar,
  onAvatarChange,
  formData
}: {
  selectedAvatar: string;
  onAvatarChange: (avatar: string) => void;
  formData: any;
}) => {
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [scriptLanguage, setScriptLanguage] = useState<string>("english"); // Initialize with a default value

  const onPlayAudio = (avatar: string) => {
    const audioPath = avatarAudioMap[avatar];
    if (!audioPath) return;

    if (playingAudio === avatar && currentAudio) {
      currentAudio.pause();
      setPlayingAudio(null);
      return;
    }

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    const audio = new Audio(audioPath);
    setCurrentAudio(audio);
    setPlayingAudio(avatar);

    audio.play().catch((err) => {
      console.error('Audio play error:', err);
      setPlayingAudio(null);
    });

    audio.onended = () => {
      setPlayingAudio(null);
      setCurrentAudio(null);
    };

    audio.onerror = () => {
      console.error('Audio failed to load');
      setPlayingAudio(null);
      setCurrentAudio(null);
    };
  };

  // Use useEffect to handle async behavior for script language detection
  useEffect(() => {
    const detectLanguageAsync = async () => {
      if (formData.script) {
        const language = await detectLanguage(formData.script);
        setScriptLanguage(language);  // Set language once detection is done
      }
    };

    detectLanguageAsync(); // Call async function to detect language
  }, [formData.script]); // Detect language whenever the script changes

  return (
    <AvatarSelection
      selectedAvatar={selectedAvatar}
      onAvatarChange={onAvatarChange}
      playingAudio={playingAudio}
      onPlayAudio={onPlayAudio}
      scriptLanguage={scriptLanguage}  // Will be updated once language is detected
    />
  );
};


// Preferences Step Component
const PreferencesStep = ({
  formData,
  setFormData,
  onBack,
  onSubmit,
  isLoading,
  playingAudio,
  onPlayAudio,
}: {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  onBack: () => void;
  onSubmit: () => void;
  isLoading: boolean;
  playingAudio: string | null;
  onPlayAudio: (avatar: string) => void;
}) => (
  <div className="max-w-2xl mx-auto">
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Video Preferences</h2>
      <p className="text-gray-600">Customize your video settings</p>
    </div>

    <div className="space-y-6">
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-4">Subtitle Options</h3>
        <div className="space-y-3">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={formData.preferences.subtitles}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                preferences: { ...prev.preferences, subtitles: e.target.checked }
              }))}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-gray-700">Enable subtitles</span>
          </label>
        </div>
      </div>

      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-4">Video Style</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'slideshow', label: 'Story' },
            { value: 'explainer', label: 'Explainer' }
          ].map((style) => (
            <button
              key={style.value}
              type="button"
              onClick={() => setFormData(prev => ({
                ...prev,
                preferences: { ...prev.preferences, style: style.value }
              }))}
              className={`p-3 rounded-lg border-2 transition-colors ${formData.preferences.style === style.value
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
                }`}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>

      {/* <AvatarSelection
        selectedAvatar={formData.preferences.avatar}
        onAvatarChange={(avatar) => setFormData(prev => ({
          ...prev,
          preferences: { ...prev.preferences, avatar }
        }))}
        playingAudio={playingAudio}
        onPlayAudio={onPlayAudio}
      /> */}


      <AudiosComponent
        selectedAvatar={formData.preferences.avatar}
        onAvatarChange={(avatar) =>
          setFormData(prev => ({
            ...prev,
            preferences: {
              ...prev.preferences,
              avatar,
            },
            formData
          }))
        }
        formData={formData}
      />


      <div className="flex space-x-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center space-x-2 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Back to Script</span>
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isLoading}
          className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
              <span>Creating Video...</span>
            </>
          ) : (
            <>
              <span>Create Video</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  </div>
);

// Result Step Component
const ResultStep = ({
  videoUrl,
  onReset
}: {
  videoUrl: string | null;
  onReset: () => void;
}) => (
  <div className="max-w-4xl mx-auto">
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Video is Ready!</h2>
      <p className="text-gray-600">Video generated successfully</p>
    </div>

    <div className="space-y-6">
      {videoUrl ? (
        <div className="bg-black rounded-lg aspect-video">
          <video
            controls
            className="w-full h-full rounded-lg"
            src={videoUrl}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center">
          <div className="text-center text-white">
            <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Video Player</p>
            <p className="text-sm opacity-75">Your generated video will appear here</p>
          </div>
        </div>
      )}

      <div className="flex space-x-4">
        <button
          onClick={onReset}
          className="flex items-center space-x-2 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <span>Create Another Video</span>
        </button>
        {videoUrl && (
          <a
            href={videoUrl}
            download
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 text-center"
          >
            <Play className="w-5 h-5" />
            <span>Download Video</span>
          </a>
        )}
      </div>
    </div>
  </div>
);

const cleanNarrationStrictly = (text: string): string => {
  // Regular expression to match unwanted characters
  const unwantedChars = /[•\*\:\;\'\"“”‘’]/g;  // Bullet, asterisk, colon, semicolon, quotes
  return text.replace(unwantedChars, "");  // Replace with an empty string
};
const detectLanguage = async (text: string): Promise<string> => {
  let scriptLangSchema = {
    "type": "object",
    "properties": {
      "language": {
        "type": "string",
        "enum": ["english", "hinglish"],
        "description": "The language of the script. 'english' or 'hinglish'."
      }
    },
    "required": ["language"],
  };

  let text_size = text.split("").length || 1;
  if (text_size >= 20) {
    text = text.slice(1, 20); // Slice to make text small for analysis
  }

  // Assuming callStructuredLlm is synchronous
  const lang = await callStructuredLlm(LLM_API_KEY, "systemPrompt", `return if given script is english or hinglish. script:${text}`, scriptLangSchema);

  // Return the detected language directly
  return lang.language;
};

// Progress Bar Component
const ProgressBar = ({ progress, status }: { progress: number; status: string }) => (
  <div className="w-full max-w-md mx-auto mt-4">
    <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
      <span>{status}</span>
      <span>{Math.round(progress)}%</span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
      <div
        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
        style={{ width: `${Math.max(5, Math.min(100, progress))}%` }}
      ></div>
    </div>
  </div>
);
// Main App Component
const PromptToVideoApp: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    prompt: '',
    modelName: 'gemini-2.0-flash-lite',
    contentClass: 'low',
    script: '',
    preferences: {
      subtitles: false,
      style: 'slideshow',
      avatar: 'female'
    }
  });
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Initializing...");


  const steps = [
    { id: 'prompt', title: 'Prompt Input', icon: Edit3 },
    { id: 'script', title: 'Script Verification', icon: Settings },
    { id: 'preferences', title: 'User Preferences', icon: Settings },
    { id: 'result', title: 'Video Result', icon: Video }
  ];

  const playAvatarAudio = useCallback((avatarType: string) => {
    if (playingAudio) {
      setPlayingAudio(null);
      return;
    }

    setPlayingAudio(avatarType);
    setTimeout(() => {
      setPlayingAudio(null);
    }, 2000);
  }, [playingAudio]);

  const handlePromptSubmit = async () => {
    if (!formData.prompt.trim()) return;

    setIsLoading(true);
    try {
      // Your API call here
      // const data = await callLlm(...);

      // console.log("generating script ",LLM_API_KEY);
      // let script  = "";
      let script = await callLlm(LLM_API_KEY, "systemPrompt", promptFormation(formData.prompt, "scriptFormation", formData), [], formData.modelName || "gemini-2.0-flash-lite");
      // let script = await callStructuredLlm( LLM_API_KEY, "systemPrompt", promptFormation(formData.prompt,"scriptFormation", formData),scriptSchema);
      //  console.log("data is ", script)
      // let scriptLang = script.language || "english";
      // setScriptLanguage(scriptLang);
      // script = script.script || "";

      script = cleanNarrationStrictly(script);
      if (script.length == 0) {
        script = `Scene 1: ${formData.prompt}\n\nThis is a sample script generated from your prompt. You can edit this script to match your vision perfectly.\n\nScene 2: Additional content based on your requirements...`;
      }


      setFormData(prev => ({ ...prev, script: script }));
      setCurrentStep(1);
    } catch (error) {
      console.error('Error generating script:', error);
      setFormData(prev => ({ ...prev, script: `Scene 1: ${formData.prompt}\n\nThis is a sample script generated from your prompt. You can edit this script to match your vision perfectly.\n\nScene 2: Additional content based on your requirements...` }));
      setCurrentStep(1);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreferencesSubmit = async () => {
    if (!formData.script || !formData.preferences) {
      alert("Please ensure your script and preferences are provided.");
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setStatusText("Queuing render job...");

    try {
      const userVideoId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const payload = {
        script: formData.script,
        preferences: formData.preferences,
        contentClass: formData.contentClass,
        user_video_id: userVideoId,
        modelName: formData.modelName,
      };

      // ── Step 1: Enqueue the job (returns 202 + jobId immediately) ──────────
      const enqueueRes = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!enqueueRes.ok) {
        const errBody = await enqueueRes.json().catch(() => ({}));
        throw new Error(errBody.error || enqueueRes.statusText);
      }

      const { jobId } = await enqueueRes.json();
      if (!jobId) throw new Error("No jobId returned from server");

      setStatusText("Job queued — waiting for worker...");

      // ── Step 2: Poll GET /api/queue?jobId=xxx until done or failed ─────────
      const POLL_INTERVAL = 2000; // 2 seconds
      const MAX_WAIT_MS = 30 * 60 * 1000; // 30 min timeout
      const startedAt = Date.now();

      await new Promise<void>((resolve, reject) => {
        const poll = async () => {
          if (Date.now() - startedAt > MAX_WAIT_MS) {
            reject(new Error("Job timed out after 30 minutes"));
            return;
          }

          try {
            const statusRes = await fetch(`/api/queue?jobId=${encodeURIComponent(jobId)}`);
            if (!statusRes.ok) {
              // Job not found yet — keep polling
              setTimeout(poll, POLL_INTERVAL);
              return;
            }

            const job = await statusRes.json();

            // Update progress UI
            if (typeof job.progress === 'number') {
              setProgress(job.progress);
            }
            if (job.statusMessage) {
              setStatusText(job.statusMessage);
            }

            if (job.status === 'done') {
              // Next.js serves public/ as the root, so strip the leading path
              const videoUrl = job.videoUrl
                ? `/${job.videoUrl}`.replace(/^\/+/, '/')
                : `/video-${jobId}.mp4`;
              setVideoUrl(videoUrl);
              setCurrentStep(3);
              resolve();
            } else if (job.status === 'failed') {
              reject(new Error(job.error || "Rendering failed"));
            } else {
              // pending or running — keep polling
              setTimeout(poll, POLL_INTERVAL);
            }
          } catch (err) {
            // Network hiccup — keep polling
            console.warn("Poll error (retrying):", err);
            setTimeout(poll, POLL_INTERVAL);
          }
        };

        poll();
      });

    } catch (error: any) {
      console.error("Error generating video:", error);
      alert("Error generating video: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(0);
    setVideoUrl(null);
    setFormData({
      prompt: '',
      modelName: 'gemini-2.0-flash-lite',
      contentClass: 'low',
      script: '',
      preferences: {
        subtitles: false,
        style: 'slideshow',
        avatar: 'female'
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-blue-600 mr-2" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              TAP
            </h1>
          </div>
          <p className="text-xl text-gray-600 font-medium">Prompt to Video Creation</p>
          <p className="text-gray-500 mt-2">Transform your ideas into engaging videos with AI</p>
        </div>

        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} steps={steps} />

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          {currentStep === 0 && (
            <PromptInputStep
              formData={formData}
              setFormData={setFormData}
              onSubmit={handlePromptSubmit}
              onDirectScriptClick={() => setCurrentStep(1)}
              isLoading={isLoading}
            />
          )}
          {currentStep === 1 && (
            <ScriptVerificationStep
              formData={formData}
              setFormData={setFormData}
              onBack={() => setCurrentStep(0)}
              onNext={() => setCurrentStep(2)}
            />
          )}

          {currentStep === 2 && (
            <>
              <PreferencesStep
                formData={formData}
                setFormData={setFormData}
                onBack={() => setCurrentStep(1)}
                onSubmit={handlePreferencesSubmit}
                isLoading={isLoading}
                playingAudio={playingAudio}
                onPlayAudio={playAvatarAudio}
              />
              {isLoading && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full mx-4">
                    <div className="text-center mb-6">
                      <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                      <h3 className="text-xl font-bold text-gray-900">Creating Your Video</h3>
                      <p className="text-gray-600 mt-2">Please wait while we bring your story to life...</p>
                    </div>
                    <ProgressBar progress={progress} status={statusText} />
                  </div>
                </div>
              )}
            </>
          )}
          {currentStep === 3 && (
            <ResultStep
              videoUrl={videoUrl}
              onReset={resetForm}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PromptToVideoApp;
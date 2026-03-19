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
    animation?: boolean;
    reviewChunks?: boolean;
    reviewPrompts?: boolean;
  };
}

type ReviewWord = {
  word: string;
  startTime: number;
  endTime: number;
};

interface ReviewItem {
  chunkId: number;
  chunkText: string;
  prompt: string;
  useGoogle: boolean;
  reasoning: string;
  startTime: number;
  endTime: number;
  words: ReviewWord[];
  mediaPath: string;
  previewUrl: string;
  selectedUrl: string;
  baselineChunkText?: string;
}

interface ReviewData {
  userVideoId: string;
  chunkingMaxWords: number;
  script: string;
  transcriptWords: ReviewWord[];
  items: ReviewItem[];
}

// Helper function to detect language
const detectLanguage = async (text: string): Promise<string> => {
  try {
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
      text = text.slice(0, 20); // Fixed: was slice(1, 20), should be slice(0, 20)
    }

    const lang = await callStructuredLlm(
      LLM_API_KEY,
      "systemPrompt",
      `return if given script is english or hinglish. script:${text}`,
      scriptLangSchema
    );

    return lang?.language || "english"; // Fallback to english if no language detected
  } catch (error) {
    console.error('Error detecting language:', error);
    return "english"; // Fallback to english on error
  }
};

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
  onSubmit,
  onDirectScriptClick,
  isLoading
}: {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  onSubmit: () => void;
  onDirectScriptClick: () => void;
  isLoading: boolean;
}) => {
  const handleDirectScript = () => {
    setFormData(prev => ({
      ...prev,
      prompt: '',
      contentClass: 'low',
    }));
    onDirectScriptClick();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">What's your vision?</h2>
        <p className="text-gray-600">Describe the video you want to create</p>
      </div>

      <div className="space-y-6">
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
            placeholder="For default it is: gemini-2.0-flash-lite"
            list="model-suggestions"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target Audience Level
          </label>
          <select
            value={formData.contentClass}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, contentClass: e.target.value }));
            }}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="low">Junior Students (Primary)</option>
            <option value="high">Senior Students (Secondary)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Video Prompt
          </label>
          <textarea
            value={formData.prompt}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, prompt: e.target.value }));
            }}
            placeholder="Describe your video idea in detail... (e.g., 'A peaceful morning scene with coffee and sunrise')"
            rows={6}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            style={{ fontSize: '16px' }}
          />
        </div>

        <div className="flex space-x-4">
          <button
            type="button"
            onClick={onSubmit}
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

          <button
            type="button"
            onClick={handleDirectScript}
            className="w-full sm:w-auto bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
          >
            <span>Direct Script</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        <datalist id="model-suggestions">
          <option value="gemini-2.0-flash-lite" />
          <option value="gemini-2.0-flash" />
          <option value="gemini-1.5-flash" />
          <option value="gemini-1.5-pro" />
        </datalist>

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
            setFormData(prev => ({ ...prev, script: e.target.value }));
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
          disabled={!formData.script.trim()}
          className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
        >
          <span>Finalize Script</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  </div>
);

// Removed AvatarSelection and avatarAudioMap

const avatarAudioMap: Record<string, string> = data.avatarAudioMap;

// AvatarSelection component removed


// Voice Selection Component
const VoiceSelection = ({
  voiceId,
  onVoiceChange,
}: {
  voiceId: string;
  onVoiceChange: (voice: string) => void;
}) => {
  return (
    <div className="bg-gray-50 p-6 rounded-lg">
      <h3 className="font-medium text-gray-900 mb-4">Voice Details</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ElevenLabs Voice ID
          </label>
          <input
            type="text"
            value={voiceId}
            onChange={(e) => onVoiceChange(e.target.value)}
            placeholder="Enter Voice ID"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-2">
            Available Voices: {data.avatars.map(a => `${a.label} (${a.value})`).join(', ')}
          </p>
        </div>
      </div>
    </div>
  );
};

// Preferences Step Component
const PreferencesStep = ({
  formData,
  setFormData,
  onBack,
  onSubmit,
  isLoading,
  loadingLabel = 'Creating Video...'
}: {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  onBack: () => void;
  onSubmit: () => void;
  isLoading: boolean;
  loadingLabel?: string;
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
          <button
            type="button"
            onClick={() => setFormData(prev => ({
              ...prev,
              preferences: { ...prev.preferences, style: 'slideshow', animation: false }
            }))}
            className={`p-3 rounded-lg border-2 transition-all duration-200 flex flex-col items-center text-center ${formData.preferences.style === 'slideshow' && !formData.preferences.animation
              ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
              : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
          >
            <span className="font-bold text-sm">Story</span>
            <span className="text-[11px] mt-1 font-medium opacity-80">Narrative Storybook Slideshow</span>
            <span className="text-[10px] mt-1 opacity-60">Classic slideshow with high-quality AI imagery</span>
          </button>
          <button
            type="button"
            onClick={() => setFormData(prev => ({
              ...prev,
              preferences: { ...prev.preferences, style: 'slideshow', animation: true }
            }))}
            className={`p-3 rounded-lg border-2 transition-all duration-200 flex flex-col items-center text-center ${formData.preferences.animation
              ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
              : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
          >
            <span className="font-bold text-sm">Animation</span>
            <span className="text-[11px] mt-1 font-medium opacity-80">Dynamic Character Animation</span>
            <span className="text-[10px] mt-1 opacity-60">Lively scenes with fluid character movements</span>
          </button>
        </div>
      </div>

      <VoiceSelection
        voiceId={formData.preferences.avatar}
        onVoiceChange={(voice) =>
          setFormData(prev => ({
            ...prev,
            preferences: {
              ...prev.preferences,
              avatar: voice,
            }
          }))
        }
      />

      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-4">Optional Review Steps</h3>
        <div className="space-y-4">
          <label className="flex items-start space-x-3">
            <input
              type="checkbox"
              checked={Boolean(formData.preferences.reviewChunks)}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                preferences: { ...prev.preferences, reviewChunks: e.target.checked }
              }))}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
            />
            <span className="text-gray-700">
              <span className="block font-medium">Review chunks before render</span>
              <span className="block text-sm text-gray-500">Inspect chunk text, timing, and optionally rebuild chunk size before the full video is created.</span>
            </span>
          </label>
          <label className="flex items-start space-x-3">
            <input
              type="checkbox"
              checked={Boolean(formData.preferences.reviewPrompts)}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                preferences: { ...prev.preferences, reviewPrompts: e.target.checked }
              }))}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
            />
            <span className="text-gray-700">
              <span className="block font-medium">Review image prompts before render</span>
              <span className="block text-sm text-gray-500">See generated preview images, edit prompts, and regenerate only the chunk you want.</span>
            </span>
          </label>
        </div>
      </div>

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
              <span>{loadingLabel}</span>
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

const ReviewStep = ({
  reviewData,
  setReviewData,
  preferences,
  onBack,
  onRechunk,
  onInsertChunk,
  onDeleteChunk,
  onMergeWithNext,
  onRefreshPrompts,
  onRefreshAllPrompts,
  onMoveWord,
  onRegenerateImage,
  onSubmit,
  isLoading,
  busyChunkId,
  reviewAction
}: {
  reviewData: ReviewData;
  setReviewData: React.Dispatch<React.SetStateAction<ReviewData | null>>;
  preferences: FormData["preferences"];
  onBack: () => void;
  onRechunk: () => void;
  onInsertChunk: (chunkId: number) => void;
  onDeleteChunk: (chunkId: number) => void;
  onMergeWithNext: (chunkId: number) => void;
  onRefreshPrompts: () => void;
  onRefreshAllPrompts: () => void;
  onMoveWord: (chunkId: number, wordIndex: number, direction: 'prev' | 'next') => void;
  onRegenerateImage: (chunkId: number) => void;
  onSubmit: () => void;
  isLoading: boolean;
  busyChunkId: number | null;
  reviewAction: 'prepare' | 'rechunk' | 'refreshChanged' | 'refreshAll' | null;
}) => (
  <div className="max-w-6xl mx-auto space-y-6">
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Review Before Final Render</h2>
      <p className="text-gray-600">Adjust chunking and prompts only if you need extra control. The normal pipeline stays unchanged when these toggles are off.</p>
    </div>

    {preferences.reviewChunks && (
      <div className="bg-gray-50 p-6 rounded-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="font-medium text-gray-900">Chunk Review</h3>
            <p className="text-sm text-gray-500">Adjust chunk boundaries using the timed words below. Word sequence always stays in transcript order.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-700">Max words per chunk</label>
            <input
              type="number"
              min={4}
              max={30}
              value={reviewData.chunkingMaxWords}
              onChange={(e) => setReviewData(prev => prev ? ({
                ...prev,
                chunkingMaxWords: Number(e.target.value) || 15
              }) : prev)}
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg"
            />
            <button
              type="button"
              onClick={onRechunk}
              disabled={reviewAction === 'rechunk' || isLoading}
              className="px-4 py-2 rounded-lg border border-blue-200 text-blue-700 bg-white hover:bg-blue-50 disabled:opacity-50 transition-colors"
            >
              {reviewAction === 'rechunk' ? 'Rebuilding Chunks...' : 'Rebuild Chunks'}
            </button>
          </div>
        </div>


        <div className="space-y-3">
          {reviewData.items.map((item, index) => (
            <div key={item.chunkId} className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Chunk {index + 1}</span>
                <span>{item.startTime.toFixed(2)}s - {item.endTime.toFixed(2)}s</span>
              </div>
              <div className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-800 min-h-[72px]">
                {item.chunkText || 'No words in this chunk yet.'}
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Word-Level Timeline</div>
                <div className="flex flex-wrap gap-2">
                  {item.words.length > 0 ? item.words.map((word, wordIndex) => (
                    <div
                      key={`${item.chunkId}-${wordIndex}-${word.startTime}`}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm"
                    >
                      <span className="font-medium text-sm text-gray-900">{word.word}</span>
                      <span className="text-[10px] text-gray-500">{word.startTime.toFixed(2)}-{word.endTime.toFixed(2)}s</span>
                      <button
                        type="button"
                        onClick={() => onMoveWord(item.chunkId, wordIndex, 'prev')}
                        disabled={index === 0 || wordIndex !== 0}
                        className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveWord(item.chunkId, wordIndex, 'next')}
                        disabled={index === reviewData.items.length - 1 || wordIndex !== item.words.length - 1}
                        className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                      >
                        Next
                      </button>
                    </div>
                  )) : (
                    <div className="text-sm text-gray-500">No words assigned to this chunk.</div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onInsertChunk(item.chunkId)}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 transition-colors text-sm"
                >
                  Insert New Below
                </button>
                <button
                  type="button"
                  onClick={() => onMergeWithNext(item.chunkId)}
                  disabled={index === reviewData.items.length - 1}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 transition-colors text-sm"
                >
                  Merge With Next
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteChunk(item.chunkId)}
                  disabled={reviewData.items.length === 1}
                  className="px-3 py-2 rounded-lg border border-red-200 text-red-700 bg-white hover:bg-red-50 disabled:opacity-40 transition-colors text-sm"
                >
                  Delete Chunk
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {preferences.reviewPrompts && (
      <div className="bg-gray-50 p-6 rounded-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="font-medium text-gray-900">Image Prompt Review</h3>
            <p className="text-sm text-gray-500">Preview every chunk image, edit the prompt, and regenerate only that chunk when needed.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onRefreshPrompts}
              disabled={Boolean(reviewAction) || isLoading}
              className="px-4 py-2 rounded-lg border border-blue-200 text-blue-700 bg-white hover:bg-blue-50 disabled:opacity-50 transition-colors"
            >
              {reviewAction === 'refreshChanged' ? 'Refreshing Changed...' : 'Refresh Changed Prompts & Images'}
            </button>
            <button
              type="button"
              onClick={onRefreshAllPrompts}
              disabled={Boolean(reviewAction) || isLoading}
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {reviewAction === 'refreshAll' ? 'Refreshing All...' : 'Refresh All Prompts & Images'}
            </button>
          </div>
        </div>

        {(reviewAction === 'refreshChanged' || reviewAction === 'refreshAll') && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-4 py-3 text-sm">
            {reviewAction === 'refreshChanged'
              ? 'Refreshing prompts and images only for changed chunks...'
              : 'Refreshing prompts and images for all chunks...'}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {reviewData.items.map((item, index) => (
            <div key={item.chunkId} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="aspect-video bg-gray-100 flex items-center justify-center">
                {item.previewUrl ? (
                  <img src={item.previewUrl} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-sm text-gray-500">No preview generated</div>
                )}
              </div>
              <div className="p-4 space-y-3">
                <div className="text-sm font-medium text-gray-900">Chunk {index + 1}</div>
                <div className="text-xs text-gray-500">{item.chunkText}</div>
                <textarea
                  value={item.prompt}
                  onChange={(e) => setReviewData(prev => prev ? ({
                    ...prev,
                    items: prev.items.map((current) =>
                      current.chunkId === item.chunkId ? { ...current, prompt: e.target.value } : current
                    )
                  }) : prev)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <label className="flex items-center space-x-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={item.useGoogle}
                    onChange={(e) => setReviewData(prev => prev ? ({
                      ...prev,
                      items: prev.items.map((current) =>
                        current.chunkId === item.chunkId ? { ...current, useGoogle: e.target.checked } : current
                      )
                    }) : prev)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span>Use Google image search for this chunk</span>
                </label>
                <button
                  type="button"
                  onClick={() => onRegenerateImage(item.chunkId)}
                  disabled={busyChunkId === item.chunkId || Boolean(reviewAction) || isLoading}
                  className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {busyChunkId === item.chunkId ? "Regenerating..." : "Regenerate This Image"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    <div className="flex space-x-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center space-x-2 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
        <span>Back to Preferences</span>
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={isLoading}
        className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
      >
        <span>{isLoading ? "Creating Video..." : "Create Final Video"}</span>
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  </div>
);

// Result Step Component
const ResultStep = ({
  videoUrl,
  onReset,
  prompt,
  script
}: {
  videoUrl: string | null;
  onReset: () => void;
  prompt: string;
  script: string;
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

      {/* Video Details Section */}
      <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 space-y-4">
        <h3 className="text-lg font-semibold text-blue-900 flex items-center">
          <Sparkles className="w-5 h-5 mr-2" />
          Video Details
        </h3>
        <div>
          <h4 className="text-sm font-bold text-blue-800 mb-1">Original Prompt:</h4>
          <p className="text-sm text-gray-700 italic">"{prompt || 'No prompt provided'}"</p>
        </div>
        <div>
          <h4 className="text-sm font-bold text-blue-800 mb-1">Script Chunks:</h4>
          <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {(script || '').split(/\n\n|Scene/).filter(Boolean).map((chunk, i) => (
              <div key={i} className="text-xs bg-white p-2 rounded border border-blue-200 text-gray-600">
                <span className="font-mono text-blue-400 mr-2">#{i + 1}</span>
                {chunk.trim()}
              </div>
            ))}
          </div>
        </div>
      </div>

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

// Helper function
const cleanNarrationStrictly = (text: string): string => {
  const unwantedChars = /[•\*\:\;\'\"""'']/g;
  return text.replace(unwantedChars, "");
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
const normalizeReviewWord = (word: string): string =>
  word
    .toLowerCase()
    .replace(/[?.,!?]/g, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, '')
    .trim();

const getReviewTimestampsForPhrase = (
  transcriptWords: ReviewWord[],
  phrase: string,
  searchFromIndex = 0,
  fallbackDuration = 5
): { startTime: number; endTime: number; startIndex: number; endIndex: number } => {
  const atoms: { norm: string; originalIndex: number; startTime: number; endTime: number }[] = [];
  transcriptWords.forEach((tw, idx) => {
    tw.word.split(/\s+/).filter(Boolean).forEach((part) => {
      atoms.push({
        norm: normalizeReviewWord(part),
        originalIndex: idx,
        startTime: tw.startTime,
        endTime: tw.endTime,
      });
    });
  });

  const phraseWords = phrase.split(/\s+/).map(normalizeReviewWord).filter(Boolean);
  if (!phraseWords.length || !atoms.length) {
    const start = transcriptWords[searchFromIndex]?.startTime || (transcriptWords.length ? transcriptWords[transcriptWords.length - 1].endTime : 0);
    return { startTime: start, endTime: start + fallbackDuration, startIndex: searchFromIndex, endIndex: searchFromIndex };
  }

  const startAtomIndex = atoms.findIndex((atom) => atom.originalIndex >= searchFromIndex);
  const searchStart = startAtomIndex === -1 ? 0 : startAtomIndex;

  for (let i = searchStart; i <= atoms.length - phraseWords.length; i++) {
    let match = true;
    for (let j = 0; j < phraseWords.length; j++) {
      if (atoms[i + j].norm !== phraseWords[j]) {
        match = false;
        break;
      }
    }

    if (match) {
      const matchedAtoms = atoms.slice(i, i + phraseWords.length);
      const startIndex = matchedAtoms[0].originalIndex;
      const endIndex = matchedAtoms[matchedAtoms.length - 1].originalIndex;
      return {
        startTime: transcriptWords[startIndex]?.startTime ?? 0,
        endTime: transcriptWords[endIndex]?.endTime ?? ((transcriptWords[startIndex]?.startTime ?? 0) + fallbackDuration),
        startIndex,
        endIndex,
      };
    }
  }

  const fallbackStart = transcriptWords[searchFromIndex]?.startTime || (transcriptWords.length ? transcriptWords[transcriptWords.length - 1].endTime : 0);
  return {
    startTime: fallbackStart,
    endTime: fallbackStart + fallbackDuration,
    startIndex: Math.min(searchFromIndex, Math.max(transcriptWords.length - 1, 0)),
    endIndex: Math.min(searchFromIndex, Math.max(transcriptWords.length - 1, 0)),
  };
};

const recalculateReviewTimings = (items: ReviewItem[]): ReviewItem[] => {
  let lastKnownTime = 0;

  return items.map((item) => {
    const orderedWords = [...(item.words || [])]
      .filter((word) => word.word && word.word.trim().length > 0)
      .sort((a, b) => a.startTime - b.startTime);

    if (orderedWords.length === 0) {
      return {
        ...item,
        chunkText: '',
        startTime: lastKnownTime,
        endTime: lastKnownTime,
        words: [],
      };
    }

    const startTime = orderedWords[0].startTime;
    const endTime = orderedWords[orderedWords.length - 1].endTime;
    lastKnownTime = endTime;

    return {
      ...item,
      chunkText: orderedWords.map((word) => word.word).join(' ').trim(),
      startTime,
      endTime,
      words: orderedWords,
    };
  });
};

const syncReviewTimings = (data: ReviewData): ReviewData => ({
  ...data,
  items: recalculateReviewTimings(data.items),
});

const normalizeReviewData = (data: ReviewData): ReviewData => {
  const synced = syncReviewTimings(data);
  return {
    ...synced,
    items: synced.items.map((item) => ({
      ...item,
      baselineChunkText: item.baselineChunkText ?? item.chunkText,
    })),
  };
};

const PromptToVideoApp: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isScriptLoading, setIsScriptLoading] = useState(false);
  const [isRenderLoading, setIsRenderLoading] = useState(false);
  const [reviewAction, setReviewAction] = useState<'prepare' | 'rechunk' | 'refreshChanged' | 'refreshAll' | null>(null);
  const [busyChunkId, setBusyChunkId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Preparing render...");

  const [formData, setFormData] = useState<FormData>({
      prompt: '',
      modelName: '',
      contentClass: 'low',
      script: '',
      preferences: {
        subtitles: false,
        style: 'slideshow',
        avatar: 'X0Kc6dUd5Kws5uwEyOnL',
        animation: false,
        reviewChunks: false,
        reviewPrompts: false,
      }
  });
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoHistory, setVideoHistory] = useState<any[]>([]);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);

  useEffect(() => {
    const history = localStorage.getItem('video_creation_history');
    if (history) {
      try {
        setVideoHistory(JSON.parse(history));
      } catch (e) {
        console.error("Failed to parse video history", e);
      }
    }
  }, []);

  const reviewEnabled = Boolean(formData.preferences.reviewChunks || formData.preferences.reviewPrompts);
  const steps = reviewEnabled ? [
    { id: 'prompt', title: 'Prompt Input', icon: Edit3 },
    { id: 'script', title: 'Script Verification', icon: Settings },
    { id: 'preferences', title: 'User Preferences', icon: Settings },
    { id: 'review', title: 'Review', icon: Sparkles },
    { id: 'result', title: 'Video Result', icon: Video }
  ] : [
    { id: 'prompt', title: 'Prompt Input', icon: Edit3 },
    { id: 'script', title: 'Script Verification', icon: Settings },
    { id: 'preferences', title: 'User Preferences', icon: Settings },
    { id: 'result', title: 'Video Result', icon: Video }
  ];
  const stepIndicatorIndex = reviewEnabled
    ? currentStep
    : currentStep === 4
      ? 3
      : currentStep;

  const handlePromptSubmit = async () => {
    if (!formData.prompt.trim()) return;

    setIsScriptLoading(true);
    try {
      let script = await callLlm(LLM_API_KEY, "write video script refering examples with correct punctuations and pauses by comma , in required language english/hindi or hinglish", promptFormation(formData.prompt, "scriptFormation", formData), [], formData.modelName || "gemini-2.0-flash-lite");

      // script = cleanNarrationStrictly(script);
      if (script.length === 0) {
        script = `Scene 1: ${formData.prompt}\n\nThis is a sample script generated from your prompt. You can edit this script to match your vision perfectly.\n\nScene 2: Additional content based on your requirements...`;
      }

      setFormData(prev => ({ ...prev, script: script }));
      setCurrentStep(1);
    } catch (error) {
      console.error('Error generating script:', error);
      setFormData(prev => ({
        ...prev,
        script: `Scene 1: ${formData.prompt}\n\nThis is a sample script generated from your prompt. You can edit this script to match your vision perfectly.\n\nScene 2: Additional content based on your requirements...`
      }));
      setCurrentStep(1);
    } finally {
      setIsScriptLoading(false);
    }
  };

  const persistVideoResult = useCallback((jobId: string, finalVideoUrl: string) => {
    const newVideo = {
      id: jobId,
      prompt: formData.prompt,
      script: formData.script,
      videoUrl: finalVideoUrl,
      timestamp: new Date().toISOString(),
      preferences: formData.preferences,
      targetLevel: formData.contentClass === 'low' ? 'Junior' : 'Senior'
    };

    const updatedHistory = [newVideo, ...videoHistory].slice(0, 10);
    setVideoHistory(updatedHistory);
    localStorage.setItem('video_creation_history', JSON.stringify(updatedHistory));
    localStorage.setItem('last_video_prompt', formData.prompt);
    localStorage.setItem('last_video_script', formData.script);
  }, [formData, videoHistory]);

  const submitFinalRender = useCallback(async (activeReviewData: ReviewData | null) => {
    setIsRenderLoading(true);
    setProgress(5);
    setStatusText("Queuing render job...");

    try {
      const userVideoId = activeReviewData?.userVideoId || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const payload = {
        script: formData.script,
        preferences: formData.preferences,
        contentClass: formData.contentClass,
        user_video_id: userVideoId,
        modelName: formData.modelName,
        reviewData: activeReviewData,
      };

      const response = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || response.statusText);
      }

      const { jobId } = await response.json();
      if (!jobId) throw new Error("No jobId returned from server");

      setStatusText("Job queued - waiting for worker...");

      const POLL_INTERVAL = 2000;
      const MAX_WAIT_MS = 30 * 60 * 1000;
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
              setTimeout(poll, POLL_INTERVAL);
              return;
            }

            const job = await statusRes.json();
            if (typeof job.progress === 'number') setProgress(job.progress);
            if (job.statusMessage) setStatusText(job.statusMessage);

            if (job.status === 'done') {
              const finalVideoUrl = job.videoUrl ? `/${job.videoUrl}`.replace(/^\/+/, '/') : `/video-${jobId}.mp4`;
              setVideoUrl(finalVideoUrl);
              persistVideoResult(jobId, finalVideoUrl);
              setCurrentStep(4);
              resolve();
            } else if (job.status === 'failed') {
              reject(new Error(job.error || "Rendering failed"));
            } else {
              setTimeout(poll, POLL_INTERVAL);
            }
          } catch (e) {
            console.error("Polling error:", e);
            setTimeout(poll, POLL_INTERVAL);
          }
        };
        poll();
      });
    } catch (error: any) {
      console.error("Error generating video:", error);
      alert("Error generating video: " + error.message);
    } finally {
      setIsRenderLoading(false);
    }
  }, [formData, persistVideoResult]);

  const requestReviewPlan = useCallback(async (options?: { manualChunks?: string[]; chunkingMaxWords?: number }) => {
    const userVideoId = reviewData?.userVideoId || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const response = await fetch('/api/review-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        script: formData.script,
        preferences: formData.preferences,
        contentClass: formData.contentClass,
        user_video_id: userVideoId,
        modelName: formData.modelName,
        chunkingMaxWords: options?.chunkingMaxWords ?? reviewData?.chunkingMaxWords ?? 15,
        manualChunks: options?.manualChunks,
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || response.statusText);
    }

    return response.json();
  }, [formData, reviewData]);

  const handlePreferencesSubmit = async () => {
    if (!formData.script || !formData.preferences) {
      alert("Please ensure your script and preferences are provided.");
      return;
    }

    if (reviewEnabled) {
      setReviewAction('prepare');
      try {
        const preparedReviewData = normalizeReviewData(await requestReviewPlan());
        setReviewData(preparedReviewData);
        setCurrentStep(3);
      } catch (error: any) {
        console.error("Error preparing review data:", error);
        alert("Error preparing review data: " + error.message);
      } finally {
        setReviewAction(null);
      }
      return;
    }

    await submitFinalRender(null);
  };

  const handleRechunk = async () => {
    if (!reviewData) return;
    setReviewAction('rechunk');
    try {
      const refreshed = normalizeReviewData(await requestReviewPlan({ chunkingMaxWords: reviewData.chunkingMaxWords }));
      setReviewData(refreshed);
    } catch (error: any) {
      alert("Error rebuilding chunks: " + error.message);
    } finally {
      setReviewAction(null);
    }
  };

  const handleRefreshPrompts = async () => {
    if (!reviewData) return;

    const changedChunkIds = reviewData.items
      .filter((item) => item.chunkText.trim() !== (item.baselineChunkText ?? "").trim())
      .map((item) => item.chunkId);

    if (changedChunkIds.length === 0) {
      alert("No chunk text changes found. Use 'Refresh All Prompts & Images' if you want to regenerate everything.");
      return;
    }

    setReviewAction('refreshChanged');
    try {
      const response = await fetch('/api/review-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: reviewData.script,
          modelName: formData.modelName,
          items: reviewData.items,
          changedChunkIds,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || response.statusText);
      }

      const { items: updatedItems } = await response.json();
      const updatedMap = new Map(updatedItems.map((item: ReviewItem) => [item.chunkId, item]));

      setReviewData((prev) => prev ? ({
        ...prev,
        items: prev.items.map((item) => {
          const updated = updatedMap.get(item.chunkId);
          if (!updated) {
            return item;
          }
          return {
            ...item,
            ...updated,
            baselineChunkText: item.chunkText,
          };
        }),
      }) : prev);
    } catch (error: any) {
      alert("Error refreshing changed prompts: " + error.message);
    } finally {
      setReviewAction(null);
    }
  };

  const handleRefreshAllPrompts = async () => {
    if (!reviewData) return;
    setReviewAction('refreshAll');
    try {
      const refreshed = normalizeReviewData(await requestReviewPlan({
        manualChunks: reviewData.items.map((item) => item.chunkText),
        chunkingMaxWords: reviewData.chunkingMaxWords,
      }));
      setReviewData(refreshed);
    } catch (error: any) {
      alert("Error refreshing all prompts: " + error.message);
    } finally {
      setReviewAction(null);
    }
  };

  const handleMoveWord = (chunkId: number, wordIndex: number, direction: 'prev' | 'next') => {
    setReviewData((prev) => {
      if (!prev) return prev;
      const chunkIndex = prev.items.findIndex((item) => item.chunkId === chunkId);
      if (chunkIndex === -1) return prev;

      const targetIndex = direction === 'prev' ? chunkIndex - 1 : chunkIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.items.length) return prev;

      const items = prev.items.map((item) => ({ ...item, words: [...item.words] }));
      const isBoundaryMove =
        (direction === 'prev' && wordIndex === 0) ||
        (direction === 'next' && wordIndex === items[chunkIndex].words.length - 1);
      if (!isBoundaryMove) return prev;

      const [movedWord] = items[chunkIndex].words.splice(wordIndex, 1);
      if (!movedWord) return prev;

      if (direction === 'prev') {
        items[targetIndex].words.push(movedWord);
      } else {
        items[targetIndex].words.unshift(movedWord);
      }

      return syncReviewTimings({ ...prev, items });
    });
  };

  const handleRegenerateImage = async (chunkId: number) => {
    if (!reviewData) return;
    const target = reviewData.items.find((item) => item.chunkId === chunkId);
    if (!target) return;

    setBusyChunkId(chunkId);
    try {
      const response = await fetch('/api/review-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: target.prompt,
          useGoogle: target.useGoogle,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || response.statusText);
      }

      const updatedAsset = await response.json();
      setReviewData(prev => prev ? ({
        ...prev,
        items: prev.items.map((item) =>
          item.chunkId === chunkId
            ? {
                ...item,
                mediaPath: updatedAsset.mediaPath,
                previewUrl: updatedAsset.previewUrl,
                selectedUrl: updatedAsset.selectedUrl,
              }
            : item
        )
      }) : prev);
    } catch (error: any) {
      alert("Error regenerating image: " + error.message);
    } finally {
      setBusyChunkId(null);
    }
  };

  const handleInsertChunk = (chunkId: number) => {
    setReviewData(prev => {
      if (!prev) return prev;
      const insertIndex = prev.items.findIndex((item) => item.chunkId === chunkId);
      if (insertIndex === -1) return prev;

      const newChunk: ReviewItem = {
        chunkId: Date.now(),
        chunkText: '',
        prompt: '',
        useGoogle: false,
        reasoning: '',
        startTime: prev.items[insertIndex].endTime,
        endTime: prev.items[insertIndex].endTime,
        words: [],
        mediaPath: '',
        previewUrl: '',
        selectedUrl: '',
        baselineChunkText: '',
      };

      const items = [...prev.items];
      items.splice(insertIndex + 1, 0, newChunk);
      return syncReviewTimings({ ...prev, items });
    });
  };

  const handleDeleteChunk = (chunkId: number) => {
    setReviewData(prev => {
      if (!prev || prev.items.length === 1) return prev;
      const index = prev.items.findIndex((item) => item.chunkId === chunkId);
      if (index === -1) return prev;

      const items = prev.items.map((item) => ({ ...item, words: [...item.words] }));
      const removed = items[index];
      if (removed.words.length > 0) {
        if (index < items.length - 1) {
          items[index + 1].words = [...removed.words, ...items[index + 1].words];
        } else if (index > 0) {
          items[index - 1].words = [...items[index - 1].words, ...removed.words];
        }
      }

      items.splice(index, 1);
      return syncReviewTimings({
        ...prev,
        items,
      });
    });
  };

  const handleMergeWithNext = (chunkId: number) => {
    setReviewData(prev => {
      if (!prev) return prev;
      const index = prev.items.findIndex((item) => item.chunkId === chunkId);
      if (index === -1 || index === prev.items.length - 1) return prev;

      const current = prev.items[index];
      const next = prev.items[index + 1];
      const mergedItem: ReviewItem = {
        ...current,
        chunkText: `${current.chunkText} ${next.chunkText}`.trim(),
        prompt: current.prompt || next.prompt,
        useGoogle: current.useGoogle || next.useGoogle,
        endTime: next.endTime,
        words: [...current.words, ...next.words],
        mediaPath: current.mediaPath,
        previewUrl: current.previewUrl,
        selectedUrl: current.selectedUrl,
        baselineChunkText: current.baselineChunkText,
      };

      const items = [...prev.items];
      items.splice(index, 2, mergedItem);
      return syncReviewTimings({ ...prev, items });
    });
  };
  const resetForm = () => {
    setCurrentStep(0);
    setVideoUrl(null);
    setReviewData(null);
    setFormData({
      prompt: '',
      contentClass: 'low',
      script: '',
      modelName: 'gemini-2.0-flash-lite',
      preferences: {
        subtitles: false,
        style: 'slideshow',
        avatar: 'XfNU2rGpBa01ckF309OY', // Reset to default avatar
        animation: false,
        reviewChunks: false,
        reviewPrompts: false,
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
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

        <StepIndicator currentStep={stepIndicatorIndex} steps={steps} />

        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          {currentStep === 0 && (
            <PromptInputStep
              formData={formData}
              setFormData={setFormData}
              onSubmit={handlePromptSubmit}
              onDirectScriptClick={() => setCurrentStep(1)}
              isLoading={isScriptLoading}
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
                isLoading={Boolean(reviewAction === 'prepare' || isRenderLoading)}
                loadingLabel={reviewEnabled ? 'Preparing Review...' : 'Creating Video...'}
              />
              {isRenderLoading && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full mx-4">
                    <div className="text-center mb-6">
                      <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                      <h3 className="text-xl font-bold text-gray-900">Creating Your Video</h3>
                      <p className="text-gray-600 mt-2">Please wait while we render the final video.</p>
                    </div>
                    <ProgressBar progress={progress} status={statusText} />
                  </div>
                </div>
              )}
            </>
          )}
          {currentStep === 3 && (
            reviewData ? (
              <ReviewStep
                reviewData={reviewData}
                setReviewData={setReviewData}
                preferences={formData.preferences}
                onBack={() => setCurrentStep(2)}
                onRechunk={handleRechunk}
                onInsertChunk={handleInsertChunk}
                onDeleteChunk={handleDeleteChunk}
                onMergeWithNext={handleMergeWithNext}
                onRefreshPrompts={handleRefreshPrompts}
                onRefreshAllPrompts={handleRefreshAllPrompts}
                onMoveWord={handleMoveWord}
                onRegenerateImage={handleRegenerateImage}
                onSubmit={() => submitFinalRender(reviewData)}
                isLoading={isRenderLoading}
                busyChunkId={busyChunkId}
                reviewAction={reviewAction}
              />
            ) : (
              <div className="text-center text-gray-500 py-12">No review data loaded yet.</div>
            )
          )}
          {currentStep === 4 && (
            <ResultStep
              videoUrl={videoUrl}
              onReset={resetForm}
              prompt={formData.prompt}
              script={formData.script}
            />
          )}
        </div>

      </div>
    </div>
  );
};

export default PromptToVideoApp;










import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Persona, CameraSettings, CreatorAttributes, ModelType, AspectRatio } from "../types";

// Helper to get the AI client with the latest key
const getAiClient = () => {
  const apiKey = localStorage.getItem('gemini_api_key') || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found. Please click the Key icon to register your API Key.");
  }
  return new GoogleGenAI({ apiKey });
};

const cleanBase64 = (base64Data: string): string => {
  return base64Data.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
};

const getModelName = (type: ModelType) => {
  return type === 'pro' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
};

// Centralized error handler
const handleGeminiError = (error: any, modelType?: ModelType) => {
  console.error("Gemini Operation Error:", error);
  const msg = error.message || error.toString();
  
  if (msg.includes("403") || msg.includes("PERMISSION_DENIED")) {
    if (modelType === 'pro') {
      throw new Error("Access Denied (403). 'Banana Pro' requires a Google Cloud Project with Billing enabled. Please switch to 'Flash Lite' or use a paid API key.");
    }
    throw new Error("Access Denied (403). Please check if your API Key is valid and has permissions for the Generative AI API.");
  }
  
  if (msg.includes("429")) {
    throw new Error("Quota Exceeded (429). You are generating too fast. Please wait a moment.");
  }

  throw error;
};

/**
 * Step 0: Generate a base Reference Image from scratch (Maker Mode)
 */
export const generateReferenceImage = async (
  attrs: CreatorAttributes, 
  modelType: ModelType = 'standard',
  aspectRatio: AspectRatio = '1:1'
): Promise<string> => {
  const ai = getAiClient();
  
  const prompt = `
    Generate a high-quality, photorealistic portrait of a virtual fashion model.
    
    VISUAL ATTRIBUTES:
    - Gender: ${attrs.gender}
    - Age Appearance: Approx ${attrs.age} years old
    - Ethnicity/Heritage: ${attrs.ethnicity}
    - Physique: ${attrs.build} build, approx ${attrs.height}cm tall
    - Face: ${attrs.eyeColor} eyes, clear skin texture
    
    HAIR & STYLE:
    - Hair: ${attrs.hairColor}, ${attrs.hairStyle}
    - Fashion: ${attrs.fashionStyle}
    - Vibe: ${attrs.vibe}

    COMPOSITION: 
    Professional studio photography, front-facing portrait or 3/4 view.
    Neutral, soft-focus background. 
    Lighting: Cinematic studio lighting, 8k resolution, highly detailed.
  `;

  try {
    const response = await ai.models.generateContent({
      model: getModelName(modelType),
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
        }
      }
    });

    if (response.candidates && response.candidates.length > 0) {
      const parts = response.candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      const textPart = parts.find(p => p.text);
      if (textPart?.text) {
        throw new Error(`Model refused: ${textPart.text}`);
      }
    }
    throw new Error("No image generated.");
  } catch (error: any) {
    handleGeminiError(error, modelType);
    throw new Error("Failed to generate reference image");
  }
};

/**
 * Step 1: Analyze the image to create a Detailed Persona (IN KOREAN)
 */
export const analyzePersona = async (referenceImageBase64: string): Promise<Persona> => {
  const ai = getAiClient();
  
  const prompt = `
    이 사진 속 인물의 시각적 특징을 깊이 분석하여 구체적인 "인플루언서 페르소나"를 설정해주세요.
    응답은 반드시 **한국어(Korean)**로 작성해야 합니다.
    
    다음 항목들을 상상력을 발휘하여 구체적으로 정의하세요:
    1. **나이(Age)**: 대략적인 나이대 (예: 20대 중반, 30대 초반)
    2. **직업(Occupation)**: 외모와 분위기에 어울리는 직업 (예: 피트니스 강사, 스타트업 CEO, 여행 작가)
    3. **성격(Personality)**: 표정과 포즈에서 느껴지는 성격 (예: 자신감 넘치고 외향적, 차분하고 지적임)
    4. **라이프스타일(Lifestyle)**: 즐길 것 같은 취미나 생활 방식 (예: 주말마다 서핑, 럭셔리 호텔 투어, 빈티지 카페 탐방)
    5. **스타일(Vibe)**: 전반적인 패션 및 분위기 키워드
    6. **별명(Nickname)**: 부르기 쉽고 기억에 남는 별명
    7. **소개글(Description)**: 이 페르소나를 한 줄로 요약하는 문장 (15단어 이내)
    8. **해시태그**: 관련 태그 3~4개
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64(referenceImageBase64) } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nickname: { type: Type.STRING },
            age: { type: Type.STRING },
            occupation: { type: Type.STRING },
            personality: { type: Type.STRING },
            lifestyle: { type: Type.STRING },
            vibe: { type: Type.STRING },
            description: { type: Type.STRING },
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["nickname", "age", "occupation", "personality", "lifestyle", "vibe", "description", "hashtags"]
        } as Schema
      }
    });

    if (!response.text) throw new Error("Failed to generate persona");
    return JSON.parse(response.text) as Persona;
  } catch (error) {
    handleGeminiError(error);
    return {} as Persona; // Unreachable
  }
};

/**
 * Step 2: Plan the story (Generate 8 prompts)
 */
export const planStory = async (persona: Persona, userScenario?: string): Promise<string[]> => {
  const ai = getAiClient();

  const baseContext = `
    We are creating a photo series (8 images) for a virtual influencer.
    
    INFLUENCER PROFILE (Detailed Persona):
    - Name: ${persona.nickname}
    - Age: ${persona.age}
    - Job: ${persona.occupation}
    - Personality: ${persona.personality}
    - Lifestyle: ${persona.lifestyle}
    - Vibe: ${persona.vibe}
    
    TASK:
    Create a sequential 8-frame visual storyboard. The images should look like a cohesive story or a "day in the life" photo dump.
    ${userScenario 
      ? `SPECIFIC SCENARIO: The user wants the story to be about: "${userScenario}".` 
      : `SCENARIO: Create a trending, engaging lifestyle sequence that fits their Job and Lifestyle perfectly.`}
    
    REQUIREMENTS:
    - Return exactly 8 distinct image prompts.
    - **LOCATION CONSISTENCY (CRITICAL)**: The background and location MUST remain consistent across all 8 frames.
    - Each prompt must describe the outfit, background, action, and lighting.
    - Keep the outfit relatively consistent within the story.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: baseContext,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        } as Schema
      }
    });

    if (!response.text) throw new Error("Failed to plan story");
    return JSON.parse(response.text) as string[];
  } catch (error) {
    handleGeminiError(error);
    return []; // Unreachable
  }
};

/**
 * Helper: Generate image from prompt
 */
const generateSingleImage = async (
  referenceImageBase64: string, 
  prompt: string, 
  modelType: ModelType,
  aspectRatio: AspectRatio
): Promise<string> => {
  const ai = getAiClient();

  const fullPrompt = `
    Generate a photorealistic influencer photo based on the reference person.
    
    CRITICAL INSTRUCTION: Preserve the facial identity, hair, and body type of the reference image exactly.
    
    SCENE DESCRIPTION: ${prompt}
    
    STYLE: 4k, cinematic, social media aesthetic, high detail.
  `;

  try {
    const response = await ai.models.generateContent({
      model: getModelName(modelType),
      contents: {
        parts: [
          { text: fullPrompt },
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64(referenceImageBase64) } }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
        }
      }
    });

    if (response.candidates && response.candidates.length > 0) {
      const parts = response.candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image generated");
  } catch (error) {
    // We re-throw here so the batch processor can catch it
    throw error;
  }
};

/**
 * Studio Mode
 */
export const generateStudioImage = async (
  referenceImageBase64: string,
  settings: CameraSettings,
  persona: Persona,
  modelType: ModelType,
  aspectRatio: AspectRatio
): Promise<{ url: string; prompt: string }> => {
  
  // Construct camera prompt
  let cameraDescription = "";
  if (settings.rotation < -10) cameraDescription += `Profile view from the left (${Math.abs(settings.rotation)} degrees), `;
  else if (settings.rotation > 10) cameraDescription += `Profile view from the right (${settings.rotation} degrees), `;
  else cameraDescription += "Front facing view, ";

  if (settings.vertical < -0.3) cameraDescription += "Low angle shot (worm's eye view), ";
  else if (settings.vertical > 0.3) cameraDescription += "High angle shot (bird's eye view), ";
  else cameraDescription += "Eye-level shot, ";

  if (settings.zoom > 7) cameraDescription += "Extreme close-up on face, detailed features, ";
  else if (settings.zoom > 3) cameraDescription += "Medium close-up (head and shoulders), ";
  else cameraDescription += "Full body shot, ";

  if (settings.isWideAngle) cameraDescription += "Shot with a wide-angle lens (16mm), slightly distorted perspective, ";
  else cameraDescription += "Shot with a portrait lens (85mm), ";

  const prompt = `
    Studio photography session of ${persona.nickname}. 
    Age: ${persona.age}. Occupation: ${persona.occupation}.
    ${persona.vibe} style.
    
    CAMERA SETUP: ${cameraDescription}
    
    The subject is posing professionally in a studio or clean aesthetic environment.
    Lighting should be high-quality studio lighting.
  `;

  try {
    const url = await generateSingleImage(referenceImageBase64, prompt, modelType, aspectRatio);
    return { url, prompt };
  } catch (error) {
    handleGeminiError(error, modelType);
    return { url: '', prompt: '' }; // Unreachable
  }
};

/**
 * Orchestrator
 */
export const generateStoryBatch = async (
  referenceImageBase64: string,
  prompts: string[],
  modelType: ModelType,
  aspectRatio: AspectRatio
): Promise<{ url: string; prompt: string }[]> => {
  
  // Map promises to handle individual failures but detect fatal errors
  const promises = prompts.map(async (prompt) => {
    try {
      const url = await generateSingleImage(referenceImageBase64, prompt, modelType, aspectRatio);
      return { url, prompt, success: true, error: null };
    } catch (e: any) {
      console.warn("Frame gen failed:", prompt, e.message);
      return { url: '', prompt, success: false, error: e };
    }
  });

  const results = await Promise.all(promises);

  // Check for fatal 403 errors across any of the requests
  const fatalError = results.find(r => 
    r.error && (r.error.message?.includes("403") || r.error.message?.includes("PERMISSION_DENIED"))
  );

  if (fatalError) {
    handleGeminiError(fatalError.error, modelType);
  }

  return results.filter(r => r.success && r.url).map(r => ({ url: r.url, prompt: r.prompt }));
};

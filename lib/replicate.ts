import Replicate from "replicate";

const replicateToken = process.env.REPLICATE_API_TOKEN;

export function isReplicateConfigured() {
  return Boolean(replicateToken);
}

export const replicate = replicateToken
  ? new Replicate({
      auth: replicateToken,
    })
  : null;

const SD_IMG2IMG_VERSION =
  "stability-ai/stable-diffusion-img2img:ddd4eb440853a42c055203289a3da0c8886b0b9492fe619b1c1dbd34be160ce7";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runTextToImage(prompt: string) {
  if (!replicate) {
    throw new Error("Replicate API token is missing");
  }

  const output = await replicate.run("black-forest-labs/flux-schnell", {
    input: {
      prompt,
      num_outputs: 1,
      aspect_ratio: "1:1",
      output_format: "webp",
      output_quality: 90,
    },
  });

  return Array.isArray(output) ? String(output[0]) : String(output);
}

export async function createImg2ImgPrediction(input: {
  prompt: string;
  imageUrl: string;
  strength: number;
}) {
  if (!replicate) {
    throw new Error("Replicate API token is missing");
  }

  return replicate.predictions.create({
    version: SD_IMG2IMG_VERSION,
    input: {
      prompt: input.prompt,
      image: input.imageUrl,
      prompt_strength: input.strength,
      num_inference_steps: 35,
      guidance_scale: 7.5,
      num_outputs: 1,
    },
  });
}

export async function pollPrediction(predictionId: string, timeoutMs = 90_000) {
  if (!replicate) {
    throw new Error("Replicate API token is missing");
  }

  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const prediction = await replicate.predictions.get(predictionId);

    if (prediction.status === "succeeded") {
      const output = prediction.output;
      if (Array.isArray(output)) return String(output[0]);
      return String(output);
    }

    if (prediction.status === "failed" || prediction.status === "canceled") {
      const errorMessage =
        typeof prediction.error === "string" ? prediction.error : "Replicate generation failed";
      throw new Error(errorMessage);
    }

    await wait(2000);
  }

  throw new Error("Generation timed out");
}

import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import LottieView from "lottie-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  claimShareCredit,
  generateImage,
  getCredits,
  getPrompt,
  shareGenerationToCommunity,
  watchAdCredits,
} from "@/src/lib/api";
import { pickImageFromCamera, pickImageFromGallery, saveRemoteImageToGallery } from "@/src/lib/image";
import { notifyGenerationComplete } from "@/src/lib/notifications";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { Prompt } from "@/src/types";

type SelectedImage = {
  uri: string;
  mimeType: string;
  fileName: string;
};

const HINGLISH_LOADING = [
  "Ek second yaar...",
  "AI kaam kar raha hai",
  "Almost ready yaar!",
];

export default function GenerateScreen() {
  const router = useRouter();
  const { promptId } = useLocalSearchParams<{ promptId?: string }>();
  const { getAccessToken } = useAuth();
  const { colors } = useTheme();

  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [strength, setStrength] = useState(0.7);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [isPro, setIsPro] = useState(false);
  const [rewarding, setRewarding] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadPrompt() {
      if (!promptId) {
        setPrompt(null);
        return;
      }

      const token = await getAccessToken();
      if (!token) return;

      setLoadingPrompt(true);
      try {
        const payload = await getPrompt(token, promptId);
        if (!active) return;
        setPrompt(payload.prompt);
      } catch {
        if (!active) return;
        setPrompt(null);
      } finally {
        if (active) setLoadingPrompt(false);
      }
    }

    void loadPrompt();
    return () => {
      active = false;
    };
  }, [getAccessToken, promptId]);

  useEffect(() => {
    let active = true;
    async function loadCredits() {
      const token = await getAccessToken();
      if (!token) return;
      try {
        const payload = await getCredits(token);
        if (!active) return;
        setCredits(payload.credits);
        setIsPro(payload.isPro);
      } catch {
        if (!active) return;
      }
    }

    void loadCredits();
    return () => {
      active = false;
    };
  }, [getAccessToken]);

  useEffect(() => {
    if (!generating) return;
    const timer = setInterval(() => {
      setLoadingMessageIndex((current) => (current + 1) % HINGLISH_LOADING.length);
    }, 1800);
    return () => clearInterval(timer);
  }, [generating]);

  const promptLabel = useMemo(() => {
    if (loadingPrompt) return "Loading prompt...";
    if (!prompt) return "No prompt selected";
    return `${prompt.title} (${prompt.category})`;
  }, [loadingPrompt, prompt]);

  async function onPickGallery() {
    try {
      const image = await pickImageFromGallery();
      if (!image) return;
      setSelectedImage(image);
      setGeneratedImageUrl(null);
      setGenerationId(null);
    } catch (error) {
      Alert.alert("Gallery error", error instanceof Error ? error.message : "Could not access gallery.");
    }
  }

  async function onPickCamera() {
    try {
      const image = await pickImageFromCamera();
      if (!image) return;
      setSelectedImage(image);
      setGeneratedImageUrl(null);
      setGenerationId(null);
    } catch (error) {
      Alert.alert("Camera error", error instanceof Error ? error.message : "Could not access camera.");
    }
  }

  async function refreshCredits() {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const payload = await getCredits(token);
      setCredits(payload.credits);
      setIsPro(payload.isPro);
    } catch {
      // no-op
    }
  }

  async function onWatchAdForCredits() {
    const token = await getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    setRewarding(true);
    try {
      const payload = await watchAdCredits(token, "rewarded_mobile");
      setCredits(payload.credits);
      Alert.alert("Credits added", `+${payload.grantedCredits} credits unlocked.`);
    } catch (error) {
      Alert.alert("Ad reward failed", error instanceof Error ? error.message : "Try again.");
    } finally {
      setRewarding(false);
    }
  }

  async function onGenerate() {
    if (!prompt?.id) {
      Alert.alert("Prompt required", "Select a prompt from Home before generating.");
      return;
    }
    if (!selectedImage) {
      Alert.alert("Image required", "Choose a photo from camera or gallery first.");
      return;
    }

    if (!isPro && credits <= 0) {
      Alert.alert("No credits", "Watch a rewarded ad to get 2 credits and continue.");
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    setGenerating(true);
    try {
      const formData = new FormData();
      formData.append("promptId", prompt.id);
      formData.append("strength", strength.toFixed(2));
      formData.append(
        "file",
        {
          uri: selectedImage.uri,
          name: selectedImage.fileName,
          type: selectedImage.mimeType,
        } as unknown as Blob,
      );

      const payload = await generateImage(token, formData);
      setGeneratedImageUrl(payload.generatedImageUrl);
      setGenerationId(payload.generationId);
      setIsPro(payload.isPro);
      if (!payload.isPro) {
        setCredits(Math.max(0, Number(payload.remainingCredits ?? credits)));
      }
      await notifyGenerationComplete(prompt.title);
    } catch (error) {
      Alert.alert("Generation failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setGenerating(false);
      await refreshCredits();
    }
  }

  async function onShareResult() {
    if (!generatedImageUrl) return;
    await Share.share({
      message: `Generated with PromptGallery: ${generatedImageUrl}`,
      url: generatedImageUrl,
    });
  }

  async function onWhatsAppShare() {
    if (!generatedImageUrl) return;

    const token = await getAccessToken();
    if (token) {
      await claimShareCredit(token, generationId).catch(() => null);
      await refreshCredits();
    }

    const text = encodeURIComponent(`Check out my AI transformation on PromptGallery! ${generatedImageUrl}`);
    const url = `whatsapp://send?text=${text}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert("WhatsApp not found", "Please install WhatsApp to share.");
      return;
    }

    await Linking.openURL(url);
  }

  async function onDownloadResult() {
    if (!generatedImageUrl) return;
    try {
      await saveRemoteImageToGallery(generatedImageUrl);
      Alert.alert("Saved", "Image downloaded to your gallery.");
    } catch (error) {
      Alert.alert("Download failed", error instanceof Error ? error.message : "Unable to save image.");
    }
  }

  async function onPostToCommunity() {
    if (!generationId) {
      Alert.alert("No generation", "Generate an image first.");
      return;
    }

    const token = await getAccessToken();
    if (!token) return;

    try {
      await shareGenerationToCommunity(token, generationId);
      Alert.alert("Shared", "Your generation has been posted to Community.");
    } catch (error) {
      Alert.alert("Share failed", error instanceof Error ? error.message : "Unable to post right now.");
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Generate</Text>
        <Text style={[styles.promptLabel, { color: colors.muted }]}>{promptLabel}</Text>
        <Text style={[styles.creditText, { color: colors.muted }]}>{isPro ? "Pro Unlimited" : `Credits: ${credits}`}</Text>

        {prompt ? (
          <Pressable onPress={() => router.push(`/prompt/${prompt.id}`)} style={styles.promptPreviewRow}>
            <Image source={{ uri: prompt.example_image_url }} style={styles.promptPreviewImage} />
            <View style={styles.promptPreviewTextWrap}>
              <Text style={[styles.promptPreviewTitle, { color: colors.text }]} numberOfLines={1}>
                {prompt.title}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{prompt.category}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ) : null}

        <View style={styles.pickerRow}>
          <Pressable onPress={() => void onPickCamera()} style={[styles.actionButton, { borderColor: colors.border }]}>
            <Ionicons name="camera-outline" size={18} color={colors.primary} />
            <Text style={[styles.actionButtonText, { color: colors.text }]}>Camera</Text>
          </Pressable>
          <Pressable onPress={() => void onPickGallery()} style={[styles.actionButton, { borderColor: colors.border }]}>
            <Ionicons name="images-outline" size={18} color={colors.primary} />
            <Text style={[styles.actionButtonText, { color: colors.text }]}>Gallery</Text>
          </Pressable>
        </View>

        {selectedImage ? (
          <Image source={{ uri: selectedImage.uri }} style={[styles.previewImage, { borderColor: colors.border }]} />
        ) : (
          <View style={[styles.placeholder, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={{ color: colors.muted }}>Select an image to preview</Text>
          </View>
        )}

        <View style={styles.sliderRow}>
          <Text style={[styles.sliderLabel, { color: colors.text }]}>Strength: {strength.toFixed(2)}</Text>
          <Slider
            value={strength}
            onValueChange={setStrength}
            minimumValue={0.4}
            maximumValue={0.9}
            step={0.01}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
          />
        </View>

        {!isPro && credits <= 0 ? (
          <Pressable onPress={() => void onWatchAdForCredits()} style={[styles.generateButton, { backgroundColor: colors.primary }]}>
            {rewarding ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.generateButtonText}>{"Watch Ad (30s) -> Get 2 Credits"}</Text>
            )}
          </Pressable>
        ) : (
          <Pressable onPress={() => void onGenerate()} style={[styles.generateButton, { backgroundColor: colors.primary }]}>
            {generating ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.generateButtonText}>Generate</Text>}
          </Pressable>
        )}

        {generatedImageUrl ? (
          <View style={[styles.resultWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.resultTitle, { color: colors.text }]}>Result</Text>
            <View style={styles.compareRow}>
              <Image source={{ uri: selectedImage?.uri }} style={styles.compareImage} />
              <Image source={{ uri: generatedImageUrl }} style={styles.compareImage} />
            </View>
            {!isPro ? (
              <View style={[styles.proBanner, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>Go Pro for Rs49/month - remove watermark + HD output</Text>
              </View>
            ) : null}
            <View style={styles.resultActions}>
              <Pressable onPress={() => void onShareResult()} style={[styles.resultButton, { borderColor: colors.border }]}>
                <Text style={[styles.resultButtonText, { color: colors.text }]}>Share</Text>
              </Pressable>
              <Pressable onPress={() => void onWhatsAppShare()} style={[styles.resultButton, { borderColor: colors.border }]}>
                <Text style={[styles.resultButtonText, { color: colors.text }]}>WhatsApp</Text>
              </Pressable>
              <Pressable onPress={() => void onDownloadResult()} style={[styles.resultButton, { borderColor: colors.border }]}>
                <Text style={[styles.resultButtonText, { color: colors.text }]}>Download</Text>
              </Pressable>
              <Pressable onPress={() => void onPostToCommunity()} style={[styles.resultButton, { borderColor: colors.border }]}>
                <Text style={[styles.resultButtonText, { color: colors.text }]}>Post to Community</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {generating ? (
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <LottieView
              source={require("../../assets/lottie/generate-loading.json")}
              autoPlay
              loop
              style={styles.lottie}
            />
            <Text style={[styles.loadingText, { color: colors.text }]}>{HINGLISH_LOADING[loadingMessageIndex]}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  promptLabel: {
    marginTop: 6,
    fontSize: 14,
  },
  creditText: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: 13,
  },
  promptPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  promptPreviewImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  promptPreviewTextWrap: {
    flex: 1,
  },
  promptPreviewTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  pickerRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  previewImage: {
    width: "100%",
    height: 260,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  placeholder: {
    height: 220,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  sliderRow: {
    marginBottom: 12,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  generateButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  generateButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  resultWrap: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  resultTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 10,
  },
  compareRow: {
    flexDirection: "row",
    gap: 10,
  },
  compareImage: {
    flex: 1,
    height: 180,
    borderRadius: 12,
  },
  proBanner: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  resultActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  resultButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  resultButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  loadingCard: {
    borderWidth: 1,
    borderRadius: 18,
    width: "100%",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 14,
  },
  lottie: {
    width: 120,
    height: 120,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: "700",
  },
});

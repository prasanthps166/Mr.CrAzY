import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";

function buildLocalImagePath(sourceUri: string) {
  const extension = sourceUri.split(".").pop() || "jpg";
  const base = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  return `${FileSystem.cacheDirectory}${base}`;
}

export async function pickImageFromGallery() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Gallery permission is required.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 1,
  });

  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const localPath = buildLocalImagePath(asset.uri);
  await FileSystem.copyAsync({
    from: asset.uri,
    to: localPath,
  });

  return {
    uri: localPath,
    mimeType: asset.mimeType ?? "image/jpeg",
    fileName: asset.fileName ?? `upload-${Date.now()}.jpg`,
  };
}

export async function pickImageFromCamera() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Camera permission is required.");
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 1,
  });

  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const localPath = buildLocalImagePath(asset.uri);
  await FileSystem.copyAsync({
    from: asset.uri,
    to: localPath,
  });

  return {
    uri: localPath,
    mimeType: asset.mimeType ?? "image/jpeg",
    fileName: asset.fileName ?? `camera-${Date.now()}.jpg`,
  };
}

export async function saveRemoteImageToGallery(imageUrl: string) {
  const permission = await MediaLibrary.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Media library permission is required.");
  }

  const extension = imageUrl.split(".").pop() || "jpg";
  const localPath = `${FileSystem.cacheDirectory}generated-${Date.now()}.${extension}`;

  const download = await FileSystem.downloadAsync(imageUrl, localPath);
  await MediaLibrary.saveToLibraryAsync(download.uri);
  return download.uri;
}

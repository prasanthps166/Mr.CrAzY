import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/src/providers/ThemeProvider";

type AdMobBannerProps = {
  position?: "top" | "bottom";
};

let BannerAd: ((props: Record<string, unknown>) => JSX.Element) | null = null;
let BannerAdSize: { ADAPTIVE_BANNER?: string } | null = null;

try {
  const module = require("react-native-google-mobile-ads") as {
    BannerAd: (props: Record<string, unknown>) => JSX.Element;
    BannerAdSize: { ADAPTIVE_BANNER?: string };
  };
  BannerAd = module.BannerAd;
  BannerAdSize = module.BannerAdSize;
} catch {
  BannerAd = null;
  BannerAdSize = null;
}

export function AdMobBanner({ position = "bottom" }: AdMobBannerProps) {
  const { colors } = useTheme();
  const adUnitId = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID;

  if (!BannerAd || !BannerAdSize?.ADAPTIVE_BANNER || !adUnitId) {
    return (
      <View
        style={[
          styles.fallback,
          {
            borderColor: colors.border,
            backgroundColor: colors.card,
          },
        ]}
      >
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Ad slot ({position}) - configure AdMob ID
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.bannerWrap}>
      <BannerAd unitId={adUnitId} size={BannerAdSize.ADAPTIVE_BANNER} />
    </View>
  );
}

const styles = StyleSheet.create({
  bannerWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  fallback: {
    borderWidth: 1,
    borderRadius: 10,
    marginVertical: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
  },
});

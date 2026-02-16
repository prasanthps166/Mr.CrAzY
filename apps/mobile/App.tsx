import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

const todaysPlan = [
  { label: "Warm-up", value: "10 min mobility" },
  { label: "Main workout", value: "Upper body strength" },
  { label: "Nutrition", value: "2,600 kcal target" }
];

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.brand}>FitTrack</Text>
        <Text style={styles.headline}>Your daily fitness check-in</Text>

        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Steps</Text>
            <Text style={styles.metricValue}>6,240</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Water</Text>
            <Text style={styles.metricValue}>1.8L</Text>
          </View>
        </View>

        <View style={styles.planCard}>
          <Text style={styles.planTitle}>Today&apos;s Plan</Text>
          {todaysPlan.map((item) => (
            <View key={item.label} style={styles.planItem}>
              <Text style={styles.planLabel}>{item.label}</Text>
              <Text style={styles.planValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      </View>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f2f6ef"
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18
  },
  brand: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1f4a2a",
    marginBottom: 8
  },
  headline: {
    fontSize: 16,
    color: "#38513f",
    marginBottom: 20
  },
  metricRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dde8d8"
  },
  metricLabel: {
    fontSize: 12,
    color: "#5b6b60",
    marginBottom: 8
  },
  metricValue: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1d3224"
  },
  planCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#dde8d8"
  },
  planTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1d3224",
    marginBottom: 12
  },
  planItem: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#eef3eb"
  },
  planLabel: {
    fontSize: 12,
    color: "#5b6b60",
    marginBottom: 4
  },
  planValue: {
    fontSize: 15,
    color: "#233e2c",
    fontWeight: "600"
  },
});

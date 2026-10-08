import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Smartbin" }} />
      <View style={styles.container}>
        <Text style={styles.title}>Smartbin</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
  },
});

try {
  require('react-native-gesture-handler/jestSetup');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const isKnownGestureHandlerSetupIssue =
    message.includes('./src/RNGestureHandlerModule') ||
    message.includes('./src/components/GestureButtons') ||
    message.includes('./src/components/Pressable/Pressable');

  if (!isKnownGestureHandlerSetupIssue) {
    throw error;
  }
}

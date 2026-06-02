try {
  require('react-native-gesture-handler/jestSetup');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  // react-native-gesture-handler 2.31.x references legacy setup paths that are
  // absent in the installed package layout, so only ignore those known misses.
  const isKnownGestureHandlerSetupIssue =
    message.includes('./src/RNGestureHandlerModule') ||
    message.includes('./src/components/GestureButtons') ||
    message.includes('./src/components/Pressable/Pressable');

  if (!isKnownGestureHandlerSetupIssue) {
    throw error;
  }
}

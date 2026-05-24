import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing, LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface LoadingLineProps {
  visible: boolean;
}

/**
 * Linear gradient loading indicator.
 *
 * - Track: #2A2C34 (background.primary)
 * - Indicator: #1A9FFF (info blue)
 * - Animation duration: 2000ms (linear easing)
 * - Opacity transition: 200ms
 * - Translates from -width to +width
 */
export const LoadingLine: React.FC<LoadingLineProps> = ({ visible }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(0);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const handleLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  useEffect(() => {
    if (visible && containerWidth > 0) {
      // Reset position
      translateX.setValue(0);

      // Fade in
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Start the looping animation
      animationRef.current = Animated.loop(
        Animated.timing(translateX, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

      animationRef.current.start(() => {
        // Reset when loop restarts
        translateX.setValue(0);
      });
    } else {
      // Fade out (200ms)
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Stop animation
      if (animationRef.current) {
        animationRef.current.stop();
        translateX.setValue(0);
      }
    }

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [visible, containerWidth, translateX, opacity]);

  const animatedTranslateX = translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [-containerWidth, containerWidth],
  });

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.indicatorContainer,
            {
              opacity,
              transform: [{ translateX: animatedTranslateX }],
            },
          ]}
        >
          <LinearGradient
            colors={['transparent', '#1A9FFF', 'transparent']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradient}
          />
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 2,
    backgroundColor: '#2A2C34',
    overflow: 'hidden',
  },
  track: {
    flex: 1,
    position: 'relative',
  },
  indicatorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  gradient: {
    width: '100%',
    height: '100%',
  },
});

export default LoadingLine;

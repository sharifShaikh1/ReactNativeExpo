import 'dotenv/config';

export default {
  expo: {
    name: "Net Covet TT",
    slug: "mobile-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/logo.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/logo.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.netcovet.tt",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "This app uses your location to track your progress to the job site.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "This app uses your location to track your progress to the job site, even when the app is in the background.",
        NSLocationAlwaysUsageDescription: "This app uses your location to track your progress to the job site, even when the app is in the background.",
        UIBackgroundModes: [
          "location",
          "fetch"
        ]
      },
      config: {
        // prefer runtime env var; keep empty if not provided
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ""
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/logo.png",
        backgroundColor: "#ffffff"
      },
      googleServicesFile: "./google-services.json",
      permissions: [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.ACCESS_BACKGROUND_LOCATION"
      ],
      package: "com.netcovet.tt",
      edgeToEdgeEnabled: true,
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ""
        }
      }
    },
    web: {
      favicon: "./assets/logo.png"
    },
    plugins: [
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Allow $(PRODUCT_NAME) to use your location.",
          isBackgroundLocationEnabled: true
        }
      ],
      "expo-secure-store",
      "expo-font"
    ],
    extra: {
      eas: {
        projectId: "YourProjectIdHere"
      },
      // Keep public client-side values here. DO NOT include any private/secrets in expo.extra.
      APP_KEY_MOBILE: process.env.EXPO_PUBLIC_APP_KEY_MOBILE || "",
      GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ""
    }
  }
};
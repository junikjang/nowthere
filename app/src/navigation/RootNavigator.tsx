import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator, type NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";

import { AuthScreen } from "../screens/AuthScreen";
import { MapHomeScreen } from "../screens/MapHomeScreen";
import { MyAreaScreen } from "../screens/MyAreaScreen";
import { PlaceDetailScreen } from "../screens/PlaceDetailScreen";
import { PopularNowScreen } from "../screens/PopularNowScreen";
import { ShareComposerScreen } from "../screens/ShareComposerScreen";
import { colors } from "../theme/colors";

export type RootStackParamList = {
  Tabs: undefined;
  PlaceDetail: { postIds: string[]; title: string };
  ShareComposer: undefined;
  Auth: undefined;
};

export type MainTabParamList = {
  PopularNow: undefined;
  MapHome: undefined;
  MyArea: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function useRootNav() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return {
    openPlace: (postIds: string[], title: string) => nav.navigate("PlaceDetail", { postIds, title }),
    openShare: () => nav.navigate("ShareComposer"),
    openAuth: () => nav.navigate("Auth")
  };
}

function PopularTab() {
  const r = useRootNav();
  return <PopularNowScreen onOpenPlace={r.openPlace} onRequireLogin={r.openAuth} />;
}
function MapTab() {
  const r = useRootNav();
  return <MapHomeScreen onOpenPlace={r.openPlace} onOpenShare={r.openShare} />;
}
function MyAreaTab() {
  const r = useRootNav();
  return <MyAreaScreen onOpenPlace={r.openPlace} onRequireLogin={r.openAuth} />;
}

function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="MapHome"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.slate,
        tabBarStyle: {
          height: 72,
          paddingTop: 10,
          paddingBottom: 10,
          backgroundColor: colors.paper,
          borderTopColor: colors.line
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "800" },
        tabBarIcon: ({ color, size }) => {
          const iconMap = { PopularNow: "flame", MapHome: "map", MyArea: "locate" } as const;
          return <Ionicons name={iconMap[route.name]} size={size} color={color} />;
        }
      })}
    >
      <Tab.Screen name="PopularNow" component={PopularTab} options={{ title: "인기" }} />
      <Tab.Screen name="MapHome" component={MapTab} options={{ title: "지도" }} />
      <Tab.Screen name="MyArea" component={MyAreaTab} options={{ title: "내 주변" }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen name="PlaceDetail">
        {({ navigation, route }) => (
          <PlaceDetailScreen
            postIds={route.params.postIds}
            title={route.params.title}
            onBack={() => navigation.goBack()}
            onRequireLogin={() => navigation.navigate("Auth")}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ShareComposer" options={{ presentation: "modal" }}>
        {({ navigation }) => (
          <ShareComposerScreen onBack={() => navigation.goBack()} onRequireLogin={() => navigation.navigate("Auth")} />
        )}
      </Stack.Screen>
      <Stack.Screen name="Auth" options={{ presentation: "modal" }}>
        {({ navigation }) => <AuthScreen onDone={() => navigation.goBack()} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

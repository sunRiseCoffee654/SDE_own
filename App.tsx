import React from 'react';
import { SafeAreaView, StyleSheet, StatusBar, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

export default function App() {
    // Configurable via EXPO_PUBLIC_WEB_URL; falls back to localhost in dev and production HTTPS
    const devUrl = process.env.EXPO_PUBLIC_WEB_URL || (__DEV__ ? 'http://localhost:5173' : 'https://sde-orbit.app');

    if (Platform.OS === 'web') {
        return (
            <SafeAreaView style={styles.container}>
                <iframe
                    src={devUrl}
                    style={{ width: '100%', height: '100vh', border: 'none' }}
                    title="SDE Orbit"
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WebView
                source={{ uri: devUrl }}
                style={styles.webview}
                javaScriptEnabled={true}
                domStorageEnabled={true}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    webview: {
        flex: 1,
    },
});

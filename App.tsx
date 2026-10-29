import React from 'react';
import { SafeAreaView, StyleSheet, StatusBar, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

export default function App() {
    // Replace with your local machine's IP (from your terminal: 192.168.1.8)
    // or your hosted web URL
    const devUrl = 'http://192.168.1.8:5173';

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

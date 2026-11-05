import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import api from '../services/api';

// In-memory cache for time-limited signed URLs
const signedUrlCache = new Map();

export default function SecureSelfie({
  photoPath,
  style,
  placeholderIcon = 'camera',
  placeholderText = null,
  resizeMode = 'cover',
  onPress = null
}) {
  const { colors } = useTheme();
  const [resolvedUrl, setResolvedUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (!photoPath || typeof photoPath !== 'string' || !photoPath.trim()) {
      setResolvedUrl(null);
      setLoading(false);
      setLoadError(false);
      return;
    }

    const clean = photoPath.trim();

    // Direct HTTP(S) or base64 data URI
    if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:image/')) {
      setResolvedUrl(clean);
      setLoading(false);
      setLoadError(false);
      return;
    }

    // Check signed URL cache
    const cached = signedUrlCache.get(clean);
    if (cached && cached.expiresAt > Date.now()) {
      setResolvedUrl(cached.url);
      setLoading(false);
      setLoadError(false);
      return;
    }

    // Fetch signed URL via authenticated API
    setLoading(true);
    setLoadError(false);

    api.getStorageSignedUrl({ bucket: 'attendance-selfies', filePath: clean, expiresIn: 3600 })
      .then(res => {
        if (!isMounted) return;
        const signedUrl = res?.data?.signedUrl || res?.signedUrl;
        if (signedUrl) {
          // Cache URL for 50 minutes (expires in 60 mins)
          signedUrlCache.set(clean, {
            url: signedUrl,
            expiresAt: Date.now() + 50 * 60 * 1000
          });
          setResolvedUrl(signedUrl);
        } else {
          setLoadError(true);
        }
      })
      .catch(() => {
        if (isMounted) setLoadError(true);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [photoPath]);

  const content = (() => {
    if (loading) {
      return (
        <View style={[style, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lightOlive || '#f1f5f9' }]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }

    if (resolvedUrl && !loadError) {
      return (
        <Image
          source={{ uri: resolvedUrl }}
          style={style}
          resizeMode={resizeMode}
          onError={() => setLoadError(true)}
        />
      );
    }

    return (
      <View style={[style, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lightOlive || '#f1f5f9' }]}>
        <Ionicons name={placeholderIcon} size={style?.width && style.width < 50 ? 14 : 22} color={colors.primary || '#64748b'} />
        {placeholderText && style?.height && style.height > 60 ? (
          <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>
            {placeholderText}
          </Text>
        ) : null}
      </View>
    );
  })();

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}


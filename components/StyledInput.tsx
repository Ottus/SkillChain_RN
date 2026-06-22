import { Theme } from '@/constants/Theme';
import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

interface Props extends TextInputProps {
  error?: string;
}

export function StyledInput({ error, ...props }: Props) {
  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        placeholderTextColor="#9CA3AF"
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: Theme.spacing.md,
  },
  input: {
    backgroundColor: Theme.colors.inputBackground,
    color: Theme.colors.text,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  inputError: {
    borderWidth: 1,
    borderColor: Theme.colors.error,
  },
  errorText: {
    color: Theme.colors.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 12,
  },
});

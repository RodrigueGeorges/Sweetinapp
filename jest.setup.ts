/// <reference types="jest" />
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-native-community/netinfo', () => ({ fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })) }));
jest.mock('expo-contacts', () => ({ Contact: { getAllDetails: jest.fn(async () => []) }, ContactField: { PHONES: 'phones' }, getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn() }));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

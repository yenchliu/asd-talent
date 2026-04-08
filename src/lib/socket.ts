import { io } from "socket.io-client";

// In development, the Vite proxy or same-origin will handle it.
// In production, it's the same origin.
export const socket = io();

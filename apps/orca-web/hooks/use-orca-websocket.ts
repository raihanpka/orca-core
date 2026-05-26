"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { WS_BASE, type EngineWsMessage } from "@/lib/api"

type UseOrcaWebSocketOptions = {
  onMessage?: (message: EngineWsMessage) => void
}

export function useOrcaWebSocket({onMessage}: UseOrcaWebSocketOptions = {}) {
  const [status, setStatus] = useState<"connecting" | "open" | "closed" | "error">("connecting")
  const wsUrl = useMemo(() => {
    const normalized = WS_BASE.endsWith("/") ? WS_BASE.slice(0, -1) : WS_BASE
    return normalized.endsWith("/ws") ? normalized : `${normalized}/ws`
  }, [])

  const savedOnMessage = useRef(onMessage)
  useEffect(() => {
    savedOnMessage.current = onMessage
  }, [onMessage])

  useEffect(() => {
    let isMounted = true
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let socket: WebSocket | null = null

    function connect() {
      if (!isMounted) return
      setStatus("connecting")
      socket = new WebSocket(wsUrl)

      socket.onopen = () => setStatus("open")
      socket.onclose = () => {
        setStatus("closed")
        if (isMounted) {
          retryTimer = setTimeout(connect, 5000)
        }
      }
      socket.onerror = () => setStatus("error")
      socket.onmessage = (event) => {
        try {
          savedOnMessage.current?.(JSON.parse(event.data) as EngineWsMessage)
        } catch {
          setStatus("error")
        }
      }
    }

    connect()

    return () => {
      isMounted = false
      if (retryTimer) clearTimeout(retryTimer)
      socket?.close()
    }
  }, [wsUrl])

  return {status, wsUrl}
}

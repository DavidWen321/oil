package com.pipeline.calculation.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket配置类
 * <p>
 * 配置STOMP消息代理，用于实时监控数据推送和预警通知。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // 启用简单的内存消息代理
        // /topic 用于广播消息（如全局预警）
        // /queue 用于点对点消息（如特定用户的通知）
        config.enableSimpleBroker("/topic", "/queue");

        // 客户端发送消息的前缀
        config.setApplicationDestinationPrefixes("/app");

        // 用户目的地前缀（用于点对点消息）
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // WebSocket连接端点
        registry.addEndpoint("/ws/monitor")
                .setAllowedOriginPatterns("*")
                .withSockJS(); // 支持SockJS降级
    }
}

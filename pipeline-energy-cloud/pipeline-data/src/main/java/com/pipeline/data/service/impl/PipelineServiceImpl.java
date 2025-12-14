package com.pipeline.data.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.pipeline.data.domain.Pipeline;
import com.pipeline.data.mapper.PipelineMapper;
import com.pipeline.data.service.IPipelineService;
import org.springframework.stereotype.Service;

/**
 * 管道参数 服务实现类
 */
@Service
public class PipelineServiceImpl extends ServiceImpl<PipelineMapper, Pipeline> implements IPipelineService {
}

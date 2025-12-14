package com.pipeline.data.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.pipeline.data.domain.Project;
import com.pipeline.data.mapper.ProjectMapper;
import com.pipeline.data.service.IProjectService;
import org.springframework.stereotype.Service;

/**
 * 项目表 服务实现类
 */
@Service
public class ProjectServiceImpl extends ServiceImpl<ProjectMapper, Project> implements IProjectService {
}

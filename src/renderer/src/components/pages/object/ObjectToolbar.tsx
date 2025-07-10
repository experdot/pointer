import React, { useRef, useState } from 'react'
import { Button, Space, Tooltip, Dropdown, Divider, Modal, Form, Input, Select, message } from 'antd'
import {
  PlusOutlined,
  DownloadOutlined,
  UploadOutlined,
  ReloadOutlined,
  DeleteOutlined,
  MoreOutlined,
  FolderOpenOutlined,
  FolderOutlined
} from '@ant-design/icons'
import { ObjectChat } from '../../../types'
import { useAppContext } from '../../../store/AppContext'

interface ObjectToolbarProps {
  chatId: string
}

const ObjectToolbar: React.FC<ObjectToolbarProps> = ({ chatId }) => {
  const { state, dispatch } = useAppContext()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [form] = Form.useForm()

  // 从状态中获取对象聊天数据
  const chat = state.pages.find((p) => p.id === chatId) as ObjectChat | undefined

  if (!chat || chat.type !== 'object') {
    return <div>数据加载错误</div>
  }

  const { nodes, rootNodeId, expandedNodes } = chat.objectData

  // 生成唯一ID
  const generateId = () => {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 添加新节点 - 使用Modal替代window.prompt
  const handleAddNode = () => {
    setIsModalVisible(true)
  }

  // 处理Modal确认
  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()
      const { name, type, description } = values

      console.log('创建新节点:', { name, type, description, parentId: rootNodeId })

      const newNode = {
        id: generateId(),
        name: name.trim(),
        type: type,
        description: description || '',
        children: [],
        expanded: false,
        parentId: rootNodeId, // 明确设置parentId
        metadata: {
          createdAt: Date.now(),
          source: 'user' as const
        },
        properties: type === 'object' ? {} : undefined,
        value:
          type === 'string'
            ? ''
            : type === 'number'
              ? 0
              : type === 'boolean'
                ? false
                : type === 'array'
                  ? []
                  : type === 'object'
                    ? {}
                    : undefined
      }

      console.log('新节点对象:', newNode)

      dispatch({
        type: 'ADD_OBJECT_NODE',
        payload: {
          chatId: chat.id,
          node: newNode,
          parentId: rootNodeId || undefined
        }
      })

      // 展开根节点以显示新添加的节点
      if (rootNodeId && !expandedNodes.includes(rootNodeId)) {
        dispatch({
          type: 'EXPAND_OBJECT_NODE',
          payload: { chatId: chat.id, nodeId: rootNodeId }
        })
      }

      message.success(`成功添加节点：${name}`)
      setIsModalVisible(false)
      form.resetFields()
    } catch (error) {
      console.error('添加节点失败:', error)
      message.error('添加节点失败，请检查输入')
    }
  }

  // 处理Modal取消
  const handleModalCancel = () => {
    setIsModalVisible(false)
    form.resetFields()
  }

  // 导出对象为JSON
  const handleExport = () => {
    try {
      // 构建导出数据
      const exportData = {
        metadata: {
          title: chat.title,
          exportTime: new Date().toISOString(),
          version: '1.0'
        },
        objectData: chat.objectData
      }

      const jsonString = JSON.stringify(exportData, null, 2)

      // 创建下载链接
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${chat.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('导出失败:', error)
      alert('导出失败，请稍后重试')
    }
  }

  // 导入JSON数据
  const handleImport = () => {
    fileInputRef.current?.click()
  }

  // 处理文件选择
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string)

        // 验证数据格式
        if (jsonData.objectData && jsonData.objectData.nodes) {
          dispatch({
            type: 'IMPORT_OBJECT_FROM_JSON',
            payload: {
              chatId: chat.id,
              jsonData: jsonData.objectData
            }
          })
          alert('导入成功！')
        } else {
          alert('无效的文件格式')
        }
      } catch (error) {
        console.error('导入失败:', error)
        alert('导入失败，请检查文件格式')
      }
    }

    reader.readAsText(file)
    // 重置输入框
    event.target.value = ''
  }

  // 展开所有节点
  const handleExpandAll = () => {
    const allNodeIds = Object.keys(nodes)
    allNodeIds.forEach((nodeId) => {
      if (!expandedNodes.includes(nodeId)) {
        dispatch({
          type: 'EXPAND_OBJECT_NODE',
          payload: { chatId: chat.id, nodeId }
        })
      }
    })
  }

  // 折叠所有节点
  const handleCollapseAll = () => {
    expandedNodes.forEach((nodeId) => {
      dispatch({
        type: 'COLLAPSE_OBJECT_NODE',
        payload: { chatId: chat.id, nodeId }
      })
    })
  }

  // 清空对象
  const handleClear = () => {
    if (window.confirm('确定要清空所有对象数据吗？此操作不可撤销。')) {
      // 创建新的根节点
      const newRootNode = {
        id: generateId(),
        name: '根对象',
        type: 'object' as const,
        description: '对象的根节点',
        children: [],
        expanded: true,
        metadata: {
          createdAt: Date.now(),
          source: 'user' as const
        },
        properties: {}
      }

      dispatch({
        type: 'UPDATE_OBJECT_DATA',
        payload: {
          chatId: chat.id,
          data: {
            rootNodeId: newRootNode.id,
            nodes: { [newRootNode.id]: newRootNode },
            selectedNodeId: undefined,
            expandedNodes: [newRootNode.id],
            searchQuery: undefined,
            filteredNodeIds: undefined,
            generationHistory: []
          }
        }
      })
    }
  }

  // 重新生成示例数据
  const handleGenerateExample = () => {
    if (window.confirm('确定要生成示例对象数据吗？这将清空当前数据。')) {
      // 生成示例数据，包含更多有子节点的对象用于交叉分析
      const rootId = generateId()
      const userTypesId = generateId()
      const featuresId = generateId()
      const platformsId = generateId()

      // 用户类型子节点
      const adminId = generateId()
      const editorId = generateId()
      const viewerId = generateId()

      // 功能模块子节点
      const authId = generateId()
      const analyticsId = generateId()
      const notificationId = generateId()

      // 平台子节点
      const webId = generateId()
      const mobileId = generateId()
      const desktopId = generateId()

      const exampleNodes = {
        [rootId]: {
          id: rootId,
          name: '系统架构',
          type: 'object' as const,
          description: '系统架构的根对象',
          children: [userTypesId, featuresId, platformsId],
          expanded: true,
          metadata: {
            createdAt: Date.now(),
            source: 'user' as const
          },
          properties: {
            version: '2.0',
            lastModified: new Date().toISOString()
          }
        },
        // 用户类型分支
        [userTypesId]: {
          id: userTypesId,
          name: '用户类型',
          type: 'object' as const,
          description: '不同类型的用户角色',
          parentId: rootId,
          children: [adminId, editorId, viewerId],
          expanded: false,
          metadata: {
            createdAt: Date.now(),
            source: 'user' as const
          },
          properties: {
            totalTypes: 3
          }
        },
        [adminId]: {
          id: adminId,
          name: '管理员',
          type: 'object' as const,
          description: '系统管理员用户',
          parentId: userTypesId,
          children: [],
          expanded: false,
          metadata: {
            createdAt: Date.now(),
            source: 'user' as const
          },
          properties: {
            permissions: ['read', 'write', 'delete', 'manage'],
            level: 'admin'
          }
        },
        [editorId]: {
          id: editorId,
          name: '编辑者',
          type: 'object' as const,
          description: '内容编辑用户',
          parentId: userTypesId,
          children: [],
          expanded: false,
          metadata: {
            createdAt: Date.now(),
            source: 'user' as const
          },
          properties: {
            permissions: ['read', 'write'],
            level: 'editor'
          }
        },
        [viewerId]: {
          id: viewerId,
          name: '访客',
          type: 'object' as const,
          description: '只读访问用户',
          parentId: userTypesId,
          children: [],
          expanded: false,
          metadata: {
            createdAt: Date.now(),
            source: 'user' as const
          },
          properties: {
            permissions: ['read'],
            level: 'viewer'
          }
        },
        // 功能模块分支
        [featuresId]: {
          id: featuresId,
          name: '功能模块',
          type: 'object' as const,
          description: '系统主要功能模块',
          parentId: rootId,
          children: [authId, analyticsId, notificationId],
          expanded: false,
          metadata: {
            createdAt: Date.now(),
            source: 'user' as const
          },
          properties: {
            totalFeatures: 3
          }
        },
        [authId]: {
          id: authId,
          name: '认证系统',
          type: 'object' as const,
          description: '用户认证和授权',
          parentId: featuresId,
          children: [],
          expanded: false,
          metadata: {
            createdAt: Date.now(),
            source: 'user' as const
          },
          properties: {
            type: 'security',
            priority: 'high'
          }
        },
        [analyticsId]: {
          id: analyticsId,
          name: '数据分析',
          type: 'object' as const,
          description: '数据统计和分析功能',
          parentId: featuresId,
          children: [],
          expanded: false,
          metadata: {
            createdAt: Date.now(),
            source: 'user' as const
          },
          properties: {
            type: 'analytics',
            priority: 'medium'
          }
        },
        [notificationId]: {
          id: notificationId,
          name: '通知系统',
          type: 'object' as const,
          description: '消息推送和通知',
          parentId: featuresId,
          children: [],
          expanded: false,
          metadata: {
            createdAt: Date.now(),
            source: 'user' as const
          },
          properties: {
            type: 'communication',
            priority: 'low'
          }
        },
        // 平台分支
        [platformsId]: {
          id: platformsId,
          name: '支持平台',
          type: 'object' as const,
          description: '系统支持的各种平台',
          parentId: rootId,
          children: [webId, mobileId, desktopId],
          expanded: false,
          metadata: {
            createdAt: Date.now(),
            source: 'user' as const
          },
          properties: {
            totalPlatforms: 3
          }
        },
        [webId]: {
          id: webId,
          name: 'Web平台',
          type: 'object' as const,
          description: '浏览器Web应用',
          parentId: platformsId,
          children: [],
          expanded: false,
          metadata: {
            createdAt: Date.now(),
            source: 'user' as const
          },
          properties: {
            technology: 'React',
            responsive: true
          }
        },
        [mobileId]: {
          id: mobileId,
          name: '移动端',
          type: 'object' as const,
          description: '手机和平板应用',
          parentId: platformsId,
          children: [],
          expanded: false,
          metadata: {
            createdAt: Date.now(),
            source: 'user' as const
          },
          properties: {
            technology: 'React Native',
            os: ['iOS', 'Android']
          }
        },
        [desktopId]: {
          id: desktopId,
          name: '桌面端',
          type: 'object' as const,
          description: '桌面应用程序',
          parentId: platformsId,
          children: [],
          expanded: false,
          metadata: {
            createdAt: Date.now(),
            source: 'user' as const
          },
          properties: {
            technology: 'Electron',
            os: ['Windows', 'macOS', 'Linux']
          }
        }
      }

      dispatch({
        type: 'UPDATE_OBJECT_DATA',
        payload: {
          chatId: chat.id,
          data: {
            rootNodeId: rootId,
            nodes: exampleNodes,
            selectedNodeId: undefined,
            expandedNodes: [rootId],
            searchQuery: undefined,
            filteredNodeIds: undefined,
            generationHistory: []
          }
        }
      })
    }
  }

  // 更多操作菜单配置
  const moreMenuItems = [
    {
      key: 'generateExample',
      label: '生成示例数据',
      icon: <ReloadOutlined />,
      onClick: handleGenerateExample
    },
    {
      type: 'divider' as const
    },
    {
      key: 'clear',
      label: '清空所有数据',
      icon: <DeleteOutlined />,
      onClick: handleClear,
      danger: true
    }
  ]

  return (
    <div
      style={{
        padding: '12px 16px',
        backgroundColor: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}
    >
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* 主要操作按钮 */}
      <Space size="small">
        <Tooltip title="添加新节点">
          <Button
            type="primary"
            size="middle"
            icon={<PlusOutlined />}
            onClick={handleAddNode}
            style={{
              borderRadius: '6px',
              boxShadow: '0 2px 4px rgba(24, 144, 255, 0.2)'
            }}
          >
            新建
          </Button>
        </Tooltip>

        <Divider type="vertical" style={{ height: '20px', margin: '0 8px' }} />

        <Tooltip title="导入JSON文件">
          <Button
            type="text"
            size="middle"
            icon={<UploadOutlined />}
            onClick={handleImport}
            style={{
              borderRadius: '6px',
              color: '#666'
            }}
          />
        </Tooltip>

        <Tooltip title="导出为JSON">
          <Button
            type="text"
            size="middle"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            style={{
              borderRadius: '6px',
              color: '#666'
            }}
          />
        </Tooltip>
      </Space>

      {/* 视图控制按钮 */}
      <Space size="small">
        <Tooltip title="展开所有节点">
          <Button
            type="text"
            size="middle"
            icon={<FolderOpenOutlined />}
            onClick={handleExpandAll}
            style={{
              borderRadius: '6px',
              color: '#666'
            }}
          />
        </Tooltip>

        <Tooltip title="折叠所有节点">
          <Button
            type="text"
            size="middle"
            icon={<FolderOutlined />}
            onClick={handleCollapseAll}
            style={{
              borderRadius: '6px',
              color: '#666'
            }}
          />
        </Tooltip>

        <Divider type="vertical" style={{ height: '20px', margin: '0 8px' }} />

        {/* 更多操作下拉菜单 */}
        <Dropdown menu={{ items: moreMenuItems }} trigger={['click']} placement="bottomRight">
          <Button
            type="text"
            size="middle"
            icon={<MoreOutlined />}
            style={{
              borderRadius: '6px',
              color: '#666'
            }}
          />
        </Dropdown>
      </Space>

      {/* 添加节点Modal */}
      <Modal
        title="添加新节点"
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        okText="确定"
        cancelText="取消"
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            type: 'object',
            description: ''
          }}
        >
          <Form.Item
            label="节点名称"
            name="name"
            rules={[
              { required: true, message: '请输入节点名称' },
              { min: 1, max: 50, message: '节点名称长度应为1-50个字符' }
            ]}
          >
            <Input placeholder="请输入节点名称" />
          </Form.Item>

          <Form.Item
            label="节点类型"
            name="type"
            rules={[{ required: true, message: '请选择节点类型' }]}
          >
            <Select placeholder="请选择节点类型">
              <Select.Option value="object">对象 (Object)</Select.Option>
              <Select.Option value="array">数组 (Array)</Select.Option>
              <Select.Option value="string">字符串 (String)</Select.Option>
              <Select.Option value="number">数字 (Number)</Select.Option>
              <Select.Option value="boolean">布尔值 (Boolean)</Select.Option>
              <Select.Option value="function">函数 (Function)</Select.Option>
              <Select.Option value="custom">自定义 (Custom)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
          >
            <Input.TextArea 
              placeholder="请输入节点描述（可选）" 
              rows={3}
              maxLength={200}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ObjectToolbar

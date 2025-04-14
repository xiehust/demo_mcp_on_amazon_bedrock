"""
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
"""
"""
DynamoDB utility functions for the FastAPI server
"""
import os
import json
import logging
import boto3
from datetime import datetime
from typing import Dict
import hashlib
import re
from dotenv import load_dotenv
# Initialize logger
logger = logging.getLogger(__name__)
# 全局模型和服务器配置
load_dotenv()  # load env vars from .env
# DynamoDB 客户端
dynamodb_client = None
DDB_TABLE = os.environ.get("ddb_table")  # DynamoDB表名，用于存储用户配置

if DDB_TABLE:
    try:
        region = os.environ.get('AWS_REGION', 'us-east-1')
        dynamodb_client = boto3.resource('dynamodb', region_name=region)
        logger.info(f"已连接到DynamoDB, 表名: {DDB_TABLE}")
    except Exception as e:
        logger.error(f"DynamoDB连接失败: {e}")
        
        
async def save_to_ddb(user_id: str, data: dict):
    """将用户配置保存到DynamoDB"""
    if not dynamodb_client or not DDB_TABLE:
        return False
    
    try:
        table = dynamodb_client.Table(DDB_TABLE)
        response = table.put_item(
            Item={
                'userId': user_id,
                'data': json.dumps(data),
                'timestamp': datetime.now().isoformat()
            }
        )
        logger.info(f"保存用户 {user_id} 配置到DynamoDB成功")
        return True
    except Exception as e:
        logger.error(f"保存用户 {user_id} 配置到DynamoDB失败: {e}")
        return False

async def get_from_ddb(user_id: str) -> dict:
    """从DynamoDB获取用户配置"""
    if not dynamodb_client or not DDB_TABLE:
        return {}
    
    try:
        table = dynamodb_client.Table(DDB_TABLE)
        response = table.get_item(
            Key={
                'userId': user_id
            }
        )
        
        if 'Item' in response:
            data = json.loads(response['Item'].get('data', '{}'))
            logger.info(f"从DynamoDB获取用户 {user_id} 配置成功")
            return data
        else:
            logger.info(f"用户 {user_id} 在DynamoDB中无配置")
            return {}
    except Exception as e:
        logger.warning(f"从DynamoDB获取用户 {user_id} 配置失败: {e}")
        return {}
        
async def delete_from_ddb(user_id: str) -> bool:
    """从DynamoDB删除用户配置"""
    if not dynamodb_client or not DDB_TABLE:
        return False
    
    try:
        table = dynamodb_client.Table(DDB_TABLE)
        response = table.delete_item(
            Key={
                'userId': user_id
            }
        )
        logger.info(f"从DynamoDB删除用户 {user_id} 配置成功")
        return True
    except Exception as e:
        logger.error(f"从DynamoDB删除用户 {user_id} 配置失败: {e}")
        return False

async def scan_all_from_ddb() -> dict:
    """从DynamoDB扫描所有用户配置，处理分页"""
    if not dynamodb_client or not DDB_TABLE:
        return {}
    
    try:
        # 使用scan操作获取所有用户的配置，并处理分页
        table = dynamodb_client.Table(DDB_TABLE)
        configs = {}
        
        # 初始化扫描参数
        scan_params = {}
        done = False
        start_key = None
        
        # 处理分页
        while not done:
            if start_key:
                scan_params['ExclusiveStartKey'] = start_key
            
            response = table.scan(**scan_params)
            items = response.get('Items', [])
            
            # 处理当前页的结果
            for item in items:
                if 'userId' in item and 'data' in item:
                    user_id = item['userId']
                    try:
                        user_data = json.loads(item['data'])
                        configs[user_id] = user_data
                    except json.JSONDecodeError as e:
                        logger.error(f"解析用户 {user_id} 的DynamoDB数据失败: {e}")
            
            # 检查是否有更多页
            start_key = response.get('LastEvaluatedKey')
            done = start_key is None
        
        logger.info(f"已从DynamoDB扫描到 {len(configs)} 个用户的配置")
        return configs
    except Exception as e:
        logger.error(f"从DynamoDB扫描用户配置失败: {e}")
        return {}


def maybe_filter_to_n_most_recent_images(
    messages: list,
    images_to_keep: int,
    min_removal_threshold: int,
):
    """
    With the assumption that images are screenshots that are of diminishing value as
    the conversation progresses, remove all but the final `images_to_keep` tool_result
    images in place, with a chunk of min_removal_threshold to reduce the amount we
    break the implicit prompt cache.
    """
    if not images_to_keep :
        return messages

    tool_result_blocks =  [
            item['toolResult']
            for message in messages
            for item in (
                message["content"] if isinstance(message["content"], list) else []
            )
            if isinstance(item, dict) and "toolResult" in item
        ]

    total_images = sum(
        1
        for tool_result in tool_result_blocks
        for content in tool_result.get("content", [])
        if isinstance(content, dict) and  "image" in content
    )

    images_to_remove = total_images - images_to_keep
    # for better cache behavior, we want to remove in chunks
    images_to_remove -= images_to_remove % min_removal_threshold

    for tool_result in tool_result_blocks:
        if isinstance(tool_result.get("content"), list):
            new_content = []
            for content in tool_result.get("content", []):
                if isinstance(content, dict) and "image" in content:
                    if images_to_remove > 0:
                        images_to_remove -= 1
                        continue
                new_content.append(content)
            tool_result["content"] = new_content
            
def remove_cache_checkpoint(messages: list) -> list:
    """
    Remove cachePoint blocks from messages.
    
    Args:
        messages (list): A list of message dictionaries.
        
    Returns:
        list: The modified messages list with cachePoint blocks removed.
    """
    for message in messages:
        if "content" in message and isinstance(message["content"], list):
            message["content"] = [item for item in message["content"] if "cachePoint" not in item]
    return messages

def hash_filename(filepath, algorithm='md5'):
    """
    对文件名进行哈希处理，但保留原始扩展名
    """
    filename = os.path.basename(filepath)
    base, ext = os.path.splitext(filename)
    
    hash_obj = hashlib.md5(base.encode('utf-8'))
    hashed_base = hash_obj.hexdigest()
    
    return hashed_base + ext

def clean_filename(filename):
    """清理文件名，只保留允许的字符，并移除连续空格"""
    # 分离文件名和扩展名
    name, ext = os.path.splitext(filename)
    
    # 只保留允许的字符（字母数字、空格、连字符、圆括号和方括号）
    cleaned_name = re.sub(r'[^a-zA-Z0-9\s\-\(\)\[\]]', '', name)
    
    # 将连续的空格替换为单个空格
    cleaned_name = re.sub(r'\s+', ' ', cleaned_name)
    
    # 返回清理后的文件名加扩展名
    return cleaned_name + ext
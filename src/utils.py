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
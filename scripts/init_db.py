#!/usr/bin/env python3
"""数据库初始化脚本"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))

from db.init_db import init_database

if __name__ == '__main__':
    print('正在初始化数据库...')
    init_database()
    print('数据库初始化完成。')

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""GitHub Actions 用：把本地构建产物上传服务器 /kb/ 并重启 poster-gen。

用法：ALI_PWD=<密码> python .github/scripts/deploy-kb.py <dist_dir>
"""
import os
import sys


HOST = "59.110.224.189"
REMOTE_KB = "/opt/poster-gen/web/kb"


def walk_files(root):
    for base, dirs, files in os.walk(root):
        for f in files:
            fp = os.path.join(base, f)
            rel = os.path.relpath(fp, root).replace(chr(92), "/")
            yield fp, rel


def main():
    if len(sys.argv) < 2:
        raise SystemExit("usage: deploy-kb.py <dist_dir>")
    dist = sys.argv[1]
    pwd = os.environ.get("ALI_PWD")
    if not pwd:
        raise SystemExit("缺少 ALI_PWD 环境变量")
    import paramiko
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=pwd, timeout=30,
                   look_for_keys=False, allow_agent=False)
    sftp = client.open_sftp()

    def mkdirs(remote_dir):
        parts = [p for p in remote_dir.replace(chr(92), "/").split("/") if p]
        cur = ""
        for part in parts:
            cur = ("/" + part) if not cur else (cur + "/" + part)
            try:
                sftp.stat(cur)
            except FileNotFoundError:
                sftp.mkdir(cur)

    def run(cmd, timeout=180):
        _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode("utf-8", "replace")
        err = stderr.read().decode("utf-8", "replace")
        code = stdout.channel.recv_exit_status()
        print("$", cmd[:90], "->", code)
        if out.strip():
            print(out.strip()[-400:])
        if err.strip() and code != 0:
            print("ERR:", err.strip()[-400:])
        return code

    if run("rm -rf %s && mkdir -p %s" % (REMOTE_KB, REMOTE_KB)) != 0:
        raise SystemExit("remote kb reset failed")
    n = 0
    for fp, rel in walk_files(dist):
        rp = REMOTE_KB + "/" + rel
        mkdirs(os.path.dirname(rp))
        sftp.put(fp, rp)
        n += 1
    print("kb uploaded:", n, "files")
    sftp.close()
    run("systemctl restart poster-gen")
    run("sleep 2; curl -s -o /dev/null -w 'kb HTTP %{http_code}\n' http://127.0.0.1/kb/")
    client.close()
    print("DONE")


if __name__ == "__main__":
    main()

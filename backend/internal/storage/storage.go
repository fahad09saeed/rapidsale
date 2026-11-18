package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"rapidsale/backend/internal/config"
)

// Storage persists uploaded files and returns their public URL.
type Storage interface {
	Put(ctx context.Context, key string, r io.Reader, contentType string) (string, error)
}

func New(ctx context.Context, cfg *config.Config) (Storage, error) {
	switch cfg.StorageDriver {
	case "s3":
		if cfg.S3Bucket == "" {
			return nil, fmt.Errorf("S3_BUCKET is required for the s3 storage driver")
		}
		awsCfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(cfg.S3Region))
		if err != nil {
			return nil, err
		}
		public := cfg.S3PublicURL
		if public == "" {
			public = fmt.Sprintf("https://%s.s3.%s.amazonaws.com", cfg.S3Bucket, cfg.S3Region)
		}
		return &S3{client: s3.NewFromConfig(awsCfg), bucket: cfg.S3Bucket, publicURL: public}, nil
	default:
		if err := os.MkdirAll(cfg.UploadDir, 0o755); err != nil {
			return nil, err
		}
		return &Local{dir: cfg.UploadDir, publicURL: cfg.PublicBaseURL + "/uploads"}, nil
	}
}

// Local stores files on disk; they are served by the API under /uploads.
type Local struct {
	dir, publicURL string
}

func (l *Local) Put(_ context.Context, key string, r io.Reader, _ string) (string, error) {
	path := filepath.Join(l.dir, filepath.FromSlash(key))
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return "", err
	}
	f, err := os.Create(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	if _, err := io.Copy(f, r); err != nil {
		return "", err
	}
	return l.publicURL + "/" + key, nil
}

// S3 stores files in an S3 bucket (credentials come from the EC2 instance role or env).
type S3 struct {
	client    *s3.Client
	bucket    string
	publicURL string
}

func (s *S3) Put(ctx context.Context, key string, r io.Reader, contentType string) (string, error) {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:       aws.String(s.bucket),
		Key:          aws.String(key),
		Body:         r,
		ContentType:  aws.String(contentType),
		CacheControl: aws.String("public, max-age=31536000, immutable"),
	})
	if err != nil {
		return "", err
	}
	return s.publicURL + "/" + key, nil
}
